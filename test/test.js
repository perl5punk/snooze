var expect = require('chai').expect;
var proxyquire = require('proxyquire');
const context = require('aws-lambda-mock-context');

// Mock DynamoDb
var dynalite = require('dynalite'),
    dynaliteServer = dynalite({
        path: './mydb',
        createTableMs: 10,
        deleteTableMs: 10
    });
dynaliteServer.listen(4567, function(err) {
    if (err) throw err;
    console.log('Dynalite started on port 4567')
});

var aws = require('aws-sdk');
aws.config.update({
    endpoint: 'http://localhost:4567',
    region: 'US-EAST-1',
    accessKeyId: 'code',
    secretAccessKey: 'brown'
});

var snooze = require('../snooze.lambda');


describe('DynamoSetup', function () {

    var ctx = context();
    var response = null;
    var returnedError = null;
    // Fires once for the group of tests, done is mocha's callback to
    // let it know that an   async operation has completed before running the rest
    // of the tests, 2000ms is the default timeout though
    before(function (done) {
        var setup = function() {
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
                });
        };

        var doc = require('dynamodb-doc');
        var dynamodb = new doc.DynamoDB();
        var params = {
            TableName: 'snooze' /* required */
        };
        dynamodb.deleteTable(params, function(err, data) {
            if (err) {
                console.log("Table already gone, no need to delete for test.");
                setup();
            } else {
                console.log("deleting table");
                setTimeout(function() { //give dynamo its time to delete the table
                    console.log("table should be deleted");
                    setup();
                }, 50);
            }
        });
    });


    describe('If the table does not exist it should create it', function () {
        it('should return an exception saying to try again now that the table is ready', function (done) {
            expect(returnedError).to.be.a('string');
            expect(returnedError).to.equal('Call failed, but resulted in creation of table. Retry your request.');
            done();
        });
    });
});



describe('AddTask', function() {
    var ctx = context();
    var response = null;
    var returnedError = null;

    before(function(done) {

        ctx = context();
        ctx.Promise
            .then(function (res) {
                response = res;
                done();
            })
            .catch(function (err) {
                returnedError = err;
                done();
            });

        snooze.handler({
            "method": "add",
            "url": "https://yahoo.com",
            "timestamp": 1453841849
        }, ctx);
    });

    describe('Result', function () {
        it('It should have taken good values', function (done) {
            expect(response).to.be.a('object');
            expect(returnedError).to.equal(null);
            done();
        });
    });

});

describe('SeekTask', function() {
    var ctx = context();
    var response = null;
    var returnedError = null;

    before(function(done) {
        this.timeout(15000);

        ctx = context();
        ctx.Promise
            .then(function (res) {
                response = res;
                done();
            })
            .catch(function (err) {
                returnedError = err;
                done();
            });

        snooze.handler({
            "maxSeekRuntime": 1000
        }, ctx);
    });

    describe('Result', function () {
        it('It should have taken good values', function (done) {
            expect(response).to.be.a('array');
            expect(response).to.have.length(1);
            done();
        });
    });

});
