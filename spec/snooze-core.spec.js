var assert              = require('assert'),
    proxyquire          = require('proxyquire'),
    request             = require('supertest'),
    sinon               = require('sinon'),
    dynalite            = require('dynalite'),
    jwt                 = require('jsonwebtoken'),
    AWS                 = require('aws-sdk');

var testEnvVars         = require('../test/test.env.js');

var token = jwt.sign({ foo: 'bar', expires: (Date.now()/1000) + (60 * 60 * 24) }, process.env.JWT_SECRET);



// Stub Overrides

var loggerStub        = require('../util/logger');
loggerStub.log = function(message,type,payload) {
    console.log(message);
};
loggerStub['@global'] = true;

var sdcStub             = require('../util/metrics');
sdcStub.incrMetric = function(metric){ console.log('ignored metric: '+metric); };
sdcStub['@global'] = true;

var dynaliteServer = dynalite({ path: './snooze-db' });
dynaliteServer.listen(4567, function(err) {
    if (err) throw err;
    console.log('Dynalite started on port 4567')
});

var dynamoConfig = {
    endpoint: process.env.DYNAMO_ENDPOINT,
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
    region: process.env.AWS_REGION
};

var appStubs = {
    log: loggerStub,
    'aws-sdk': {
        SNS: function(){
            this.sendMessage = sinon.stub();
            this.publish = sinon.stub();
        },
        '@global': true
    },
    '../util/logger': loggerStub,
    './util/logger': loggerStub,
    './metrics': sdcStub,
    Base64: {
        encode: null
    }
};



describe('Making the POST to /add', function() {

    var editID = '';

    before(function(done) {
        setTimeout(done, 1900);
    });

    var snooze = proxyquire('../index', appStubs);
    var snoozeRunner = snooze.runner;
    snooze = snooze.app;

    describe('app routes - add', function() {

        it('tests if snooze is up', function(done){
            request(snooze)
                .get('/')
                .expect(200, 'Snooze is up.', done);
        });

        it('test against /add fails', function(done) {
            request(snooze)
                .post('/add')
                .set(process.env.JWT_HEADER, token)
                .send({})
                .expect(500, 'crap no task specified, or not a valid object wtf?!', done);
        });

        it('test against /add', function(done) {
            var date = Date.now();
            request(snooze)
                .post('/add')
                .set(process.env.JWT_HEADER, token)
                .send({ task:
                    {
                        ts: date + 10000,
                        url: 'http://www.google.com',
                        status : 1
                    }
                })
                .expect(function(res){
                    editID = res.body.id;
                    if(res.statusCode !== 200)
                    {
                        console.error(res.body);
                        throw new Error('Status expected is not 200, '+res.statusCode);
                    }
                    if(!res.body.id)
                    {
                        throw new Error('incorrect ID being returned');
                    }
                    else
                    {
                        return true;
                    }
                })
                .end(done);
        });

        it('only accepts valid json', function(done) {
            request(snooze)
                .post('/add')
                .set(process.env.JWT_HEADER, token)
                .send({task : 'String, Not Valid JSON'})
                .expect(500, 'crap no task specified, or not a valid object wtf?!', done);
        });
    });

    describe('app routes - cancel', function() {

        it('cancels a task in the queue', function (done){
            request(snooze)
                .put('/cancel/' + editID)
                .set(process.env.JWT_HEADER, token)
                .expect(200)
                .expect('Content-Type', 'application/json; charset=utf-8')
                .expect(function(res){
                    if (res.status !== 200)
                    {
                        throw new Error('status is not 200');
                    }
                    if (process.env.DYNAMO_ENDPOINT.indexOf('localhost') === -1 && res.body.task.Attributes.status !== 2)
                    {
                        throw new Error('incorrect attribute');
                    }
                    return true;
                })
                .end(done);
        });

        it('sends back an error if task is not found', function(done) {
            request(snooze)
                .put('/cancel/4')
                .expect(500)
                .expect(function(res) {
                    if (res.body.success === true)
                    {
                        throw new Error('Task should not exist');
                    }
                    else
                    {
                        return true;
                    }
                })
                .end(done);
        });

    });

    describe('app routes - Check if event exists', function() {

        it('should find an event and return its information', function(done) {

            request(snooze)
                .get('/is/' + editID)
                .expect(200)
                .expect(function(res) {
                    if(!res.body.task)
                    {
                        throw new Error('No task returned');
                    }
                    else if (!res.body.task.ts || !res.body.task.status || !res.body.task.added_timestamp)
                    {
                           throw new Error('Missing Task Information');
                    }
                    else
                    {
                        return true;
                    }
                })
                .end(done);
        });

        it('should return error when task does not exist with that id', function(done) {

            request(snooze)
                .get('/is/310')
                .expect(500)
                .expect(function(res) {
                    if (res.body.task)
                    {
                        throw new Error('There should be no task with this id');
                    }
                    else if (res.body.message !== 'Task does not exist')
                    {
                        throw new Error('Incorrect message sent back');
                    }
                    else
                    {
                        return true;
                    }
                }).end(done);

        });

    });

});