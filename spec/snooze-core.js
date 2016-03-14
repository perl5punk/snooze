var assert              = require('assert'),
    proxyquire          = require('proxyquire'),
    request             = require('supertest'),
    sinon               = require('sinon'),
    dynalite            = require('dynalite'),
    jwt                 = require('jsonwebtoken'),
    AWS                 = require('aws-sdk');

var testEnvVars         = require('../test/test.env.inc.js');

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
