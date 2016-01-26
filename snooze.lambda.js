var https = require('https');
var crypto = require('crypto');

var AWS = require('aws-sdk');
var lambda = new AWS.Lambda();
var doc = require('dynamodb-doc');
var dynamo = new doc.DynamoDB();
var urlParser = require('url');

var ddbTableName = 'snooze';
var seekInterval = 5000; // 5 seconds

exports.handler = function(event, context) {
    console.log(event);
    if (event.method == 'add') {
        console.log("Adding task!");
        addTask(event.url, event.timestamp, function(err, data) {
            console.log(err);
            console.log('Task Added!');
            context.done();
        });
    } else if (event.method == 'run') {
        runTask(context, event.url, event.ts);
    }
    else {
        seekTasks(context, function(err, data) {
            console.log(err);
            context.done();
        });
    }
};

function runTask(context, url, ts) {
    console.log('UPDATE1');
    updateStatus(context, url, ts, 2, function(err, data) {
        console.log(err);
        console.log('callurl');
        callUrl(context, url, function(res) {
            console.log('callurlgood');
            logResponse(context, url, ts, res, function() {
                updateStatus(context, url, ts, 3, function() {
                    context.done();
                });
            });
        }, function() {
            console.log('callurlbad');
            updateStatus(context, url, ts, 4, function() {
                context.done();
            });
        });
    });


}

function updateStatus(context, url, ts, status, callback) {
    dynamo.updateItem({
        TableName:ddbTableName,
        Key:{
            url:url,
            ts:ts
        },
        UpdateExpression: 'set #a = :new_status, #b = :updated_time',
        ExpressionAttributeNames: {'#a' : 'status', '#b' : 'updated_time'},
        ExpressionAttributeValues: {
            ':new_status' : status,
            ':updated_time' : Math.floor(Date.now()/1000)
        }
    }, callback);
}


function logResponse(context, url, ts, response, callback) {
    dynamo.updateItem({
        TableName:ddbTableName,
        Key:{
            url:url,
            ts:ts
        },
        UpdateExpression: 'set #a = :res',
        ExpressionAttributeNames: {'#a' : 'response'},
        ExpressionAttributeValues: {
            ':res' : response
        }
    }, callback);
}

function seekTasks(context, callback) {

    setInterval(function(){
        var nowTs = Math.floor(Date.now()/1000);
        console.log("Looking for events before: " + nowTs);
        dynamo.query({
            TableName: ddbTableName,
            IndexName: 'status-ts-index',
            KeyConditions: [dynamo.Condition("ts", "LE", nowTs),
                dynamo.Condition("status", "EQ", 0)]
        }, function(err, data) {
            if (err) {
                return callback(err, data);
            }

            console.log(data);

            for(i=0;i<data.Items.length;i++) {

                var params = {
                    FunctionName: 'snooze',
                    InvocationType: 'Event',
                    Payload: JSON.stringify({
                        method: "run",
                        url: data.Items[i].url,
                        ts: data.Items[i].ts
                    })
                };
                console.log(params);
                lambda.invoke(params, consoleSpam);
            }
        });

    }, seekInterval);

    setTimeout(function() {
        context.done();
    }, 4.9*60*1000);
}

function addTask(url, timestamp, callback) {
    dynamo.putItem({
            TableName:ddbTableName,
            Item:{
                ts:timestamp,
                status:0,
                url: url,
                added_timestamp: Math.floor(Date.now()/1000)
            }
        },
        callback);
}

function callUrl(context, url, success, fail) {
    var options = urlParser.parse(url);
    options.protocol = 'https:';
    console.log(options);
    var req = https.request(options, function(res) {
        var body = '';
        console.log('Status:', res.statusCode);
        console.log('Headers:', JSON.stringify(res.headers));
        res.setEncoding('utf8');
        res.on('data', function(chunk) {
            body += chunk;
        });
        res.on('end', function() {
            console.log('Successfully processed HTTPS response');
            if (res.headers['content-type'] === 'application/json') {
                body = JSON.parse(body);
            }
            success(body);
        });
    });
    req.on('error', fail);
    req.end();
}

var consoleSpam = function(err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else     console.log(data);           // successful response
};