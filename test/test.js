var expect = require('chai').expect;
var proxyquire = require('proxyquire');
const context = require('aws-lambda-mock-context');
const ctx = context();

// Returns a standard Node.js HTTP server
var dynalite = require('dynalite'),
    dynaliteServer = dynalite({path: './mydb', createTableMs: 50});

// Listen on port 4567
dynaliteServer.listen(4567, function(err) {
    if (err) throw err;
    console.log('Dynalite started on port 4567')
});

var aws = require('aws-sdk');

aws.config.update({
    endpoint: 'http://localhost:4567',
    region: 'US-EAST-1',
    accessKeyId: 'asdf',
    secretAccessKey: 'asdf'
});

var snooze = require('../snooze.lambda');


describe('Snooze Adding', function () {
    var response = null;
    var returnedError = null;

    // Fires once for the group of tests, done is mocha's callback to
    // let it know that an   async operation has completed before running the rest
    // of the tests, 2000ms is the default timeout though
    before(function (done) {
        //This fires the event as if a Lambda call was being sent in
        snooze.handler({
            "method": "add",
            "url": "https://yahoo.com",
            "timestamp": 1453841849
        }, ctx);

        ctx.Promise
            .then(function (res) {
                response = res;
                done();
            })
            .catch(function (err) {
                returnedError = err;
                done();
            })
    });


    describe('If the table does not exist it should create it', function () {
        it('should not have errored', function () {
            expect(returnedError).to.be.null;
        });


    })
});