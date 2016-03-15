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
    '../../logger': loggerStub,
    './logger': loggerStub,
    './metrics': sdcStub,
    Base64: {
        encode: null
    }
};

describe('Making the POST to /add', function() {

    var editID = '';

    var snoozeUrl = function() {
        if (process.env.IP_ADDRESS)
        {
            return process.env.IP_ADDRESS + ':80';
        }
        else
        {
            return 'localhost:8080';
        }
    };

    var url = snoozeUrl();
    var snooze = proxyquire('../index', appStubs);

    describe('app routes - add', function() {

        it('tests if snooze is up', function(done){
            request(url)
                .get('/')
                .expect(200, 'Snooze is up.', done);
        });

        it('test against /add fails', function(done) {
            request(url)
                .post('/add')
                .set(process.env.JWT_HEADER, token)
                .send({})
                .expect(500, 'crap no task specified, or not a valid object wtf?!', done);
        });

        it('test against /add', function(done) {
            var date = Date.now();
            request(url)
                .post('/add')
                .set(process.env.JWT_HEADER, token)
                .send({task:
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
                        throw new Error('status is not 200');
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
            request(url)
                .post('/add')
                .set(process.env.JWT_HEADER, token)
                .send({task : 'String, Not Valid JSON'})
                .expect(500, 'crap no task specified, or not a valid object wtf?!', done);
        });
    });

    describe('app routes - cancel', function() {

        it('cancels a task in the queue', function (done){
            request(url)
                .put('/cancel/' + editID)
                .expect(200)
                .expect('Content-Type', 'application/json; charset=utf-8')
                .expect(function(res){
                    if (res.status !== 200)
                    {
                        throw new Error('status is not 200');
                    }
                    else if (res.body.task.Attributes.status !== 2)
                    {
                        throw new Error('incorrect attribute');
                    }
                    else
                    {
                        return true;
                    }
                })
                .end(done);
        });

        it('sends back an error if task is not found', function(done) {
            request(url)
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

    //describe('app routes - Check if event exists', function() {
    //
    //    xit('should find an event and return its information', function(done) {
    //        //is - returns a status saying whether event exists /id/payload - GET
    //        request(url)
    //            .get('/' + editID + '/payload')
    //            .expect(200)
    //            .expect(function(res) {
    //
    //            })
    //
    //    });
    //
    //});

});