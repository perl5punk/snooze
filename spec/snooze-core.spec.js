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



describe('Snooze Test Suite', function() {

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
                .expect(500, 'crap no task specified, or not a valid object?!', done);
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
                .expect(500, 'crap no task specified, or not a valid object?!', done);
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
                    if (process.env.DYNAMO_ENDPOINT.indexOf('localhost') === -1 && res.body.task.status !== 2)
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

    describe('health check for taskrunner', function() {

        it('should return 200 if taskrunner is up', function(done) {

            request(snooze)
                .get('/health-check')
                .expect(200)
                .end(function(err, res) {
                    if(err) throw err;
                    console.log('health res : ', res.body);
                    done();
                });

        });

    });

    describe('Add tasks to taskrunner', function() {

        this.timeout(35000);
        var counter = 0;
        var id;

        var tasks = [
            {url : 'https://www.google.com', delay: 10}, //Pending = 0
            {url : 'https://www.google.com', delay : 1}, // Success = 9
            {url : 'https://www.google.com', delay : 20}, // Canceled = 2
            {delay: 1}, // Unknown = 11
            //{url : 'http://asdasd', delay : 1}, // Error = 3
            {url : 'https://asdasd.com/', delay : 1}
        ];

        function addUrlTask (url, delay)
        {
            if(url)
            {
                var payload = {task : {url : url, ts: (Date.now()/1000) + delay}};
            }
            else
            {
                var payload = {task : {ts: (Date.now()/1000) + delay}}
            }
            request(snooze)
                .post('/add')
                .set(process.env.JWT_HEADER, token)
                .send(payload)
                .end(function(err, res) {
                    id = res.body.id;
                    counter += 1;
                });
        }

        beforeEach(function(done) {
            addUrlTask(tasks[counter].url, tasks[counter].delay);
            setTimeout(done, 3000);
        });


        it('should have status pending', function(done) {
            request(snooze)
                .get('/is/' + id)
                .expect(200)
                .end(function(err, res) {
                    if(err) throw err;
                    if(res.body.task.status !== 0)
                    {
                        throw new Error('task should still be pending');
                    }
                    else
                    {
                        done();
                        return true;
                    }
                });
        });

        it('should have status success', function(done) {
            request(snooze)
                .get('/is/' + id)
                .expect(200)
                .end(function(err, res) {
                    if(err) throw err;
                    if(res.body.task.status !== 9)
                    {
                        throw new Error('Task should have been successful');
                    }
                    else
                    {
                        done();
                        return true;
                    }
                });
        });

        it('should cancel a task and have status cancelled', function(done) {
            request(snooze)
                .put('/cancel/' + id)
                .expect(200)
                .end(function(err, res) {
                    if(err) throw err;
                    if(res.body.task.status !== 2)
                    {
                        throw new Error('Task should have been cancelled');
                    }
                    else
                    {
                        done();
                        return true;
                    }
                });
        });

        it('should be unknown error with no URL entered', function(done) {
            request(snooze)
                .get('/is/' + id)
                .expect(200)
                .end(function(err, res) {
                    if(err) throw err;
                    if(res.body.task.status !== 11)
                    {
                        throw new Error('Task should be unknown, with no URL defined');
                    }
                    else
                    {
                        done();
                        return true;
                    }
                });
        });

        //it('should error with http instead of https entered', function(done) {
        //    request(snooze)
        //        .get('/is/' + id)
        //        .expect(200)
        //        .end(function(err, res) {
        //            if(err) throw err;
        //            if(res.body.task.status !== 3)
        //            {
        //                throw new Error('Task should error out, http is being used');
        //            }
        //            else
        //            {
        //                done();
        //                return true;
        //            }
        //        });
        //});

        it('should show as running if process is ongoing', function(done) {
            request(snooze)
                .get('/is/' + id)
                .expect(200)
                .end(function(err, res) {
                    if(err) throw err;
                    if(res.body.task.status !== 1)
                    {
                        throw new Error('Task should still be running');
                    }
                    else
                    {
                        done();
                        return true;
                    }
                });
        });

    });

});
