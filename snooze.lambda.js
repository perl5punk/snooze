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
    if (event.method === 'add') {
        console.log("Adding task!");
        addTask(event.url, event.timestamp, function(err, data) {
            if (err) {
                initDynamoIfNeeded(err, context);
            } else {
                console.log('Task Added!');
                context.succeed(event);
            }
        });
    } else {
        runTasks(event.maxSeekRuntime, context, function(err, data) {
            if (err) {
                console.log(err);
                initDynamoIfNeeded(err, context);
            } else {
                context.succeed();
            }
        });
    }
};

function runTask(tasksCompletedArray, url, ts) {
    console.log('running Task: ' + url);

    updateStatus(url, ts, 2, function(err, data) {
        if (err) {
            console.log(err);
            return;
        }
        console.log('status updated, now calling ' + url);

        callUrl(url, function(res) {
            console.log('call url good');
            logResponse(context, url, ts, res, function() {
                updateStatus(url, ts, 3, function(err, data) {
                    tasksCompletedArray.push({ url: url, ts: ts });
                });
            });
        }, function() {
            console.log('call url bad');
            updateStatus(url, ts, 4, function() {
                console.log('status updated to failed');
            });
        });
    });


}

function updateStatus(url, ts, status, callback) {
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

function runTasks(maxSeekRuntime, context, callback) {

    var tasksCompleted = [];

    var runDueTasks = function(){
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

            for(var i=0;i<data.Items.length;i++) {
                runTask(tasksCompleted, data.Items[i].url, data.Items[i].ts);
            }
        });

    };
    setInterval(runDueTasks, seekInterval);
    runDueTasks();

    if ('undefined' == typeof(maxSeekRuntime)) {
        maxSeekRuntime = 4.9*60*1000;
    }

    setTimeout(function() {
        context.succeed(tasksCompleted);
    }, maxSeekRuntime);
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

function callUrl(url, success, fail) {
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


function initDynamoIfNeeded(err, context) {
    if (err.name === 'ResourceNotFoundException') {
        console.log("Dynamo table missing");
        var params = {
            TableName: ddbTableName,
            AttributeDefinitions: [
                {AttributeName: 'url',      AttributeType: 'S'},
                {AttributeName: 'ts',       AttributeType: 'N'},
                {AttributeName: 'status',   AttributeType: 'N'}
            ],
            KeySchema: [
                {AttributeName: 'url',  KeyType: 'HASH'},
                {AttributeName: 'ts',   KeyType: 'RANGE'}
            ],
            ProvisionedThroughput: {
                ReadCapacityUnits: 2,
                WriteCapacityUnits: 2
            },
            GlobalSecondaryIndexes: [
                {
                    IndexName: 'status-ts-index',
                    KeySchema: [
                        {AttributeName: 'status',   KeyType: 'HASH'},
                        {AttributeName: 'ts',       KeyType: 'RANGE'}
                    ],
                    Projection: {
                        ProjectionType:'KEYS_ONLY'
                    },
                    ProvisionedThroughput: {
                        ReadCapacityUnits: 2,
                        WriteCapacityUnits: 2
                    }
                }
            ]
        };
        dynamo.createTable(params, function(createTableErr, data) {
            if (createTableErr) {
                console.log("Failed creating Table");
                context.fail(createTableErr);
            }
            else {
                var params = {
                    TableName: ddbTableName
                };
                console.log("Table creation begun");

                //dynamo.waitFor() is really slow for running in the mocha context,
                // so we fudge it, but give it enough time to actually init the table
                setTimeout(function() {
                    console.log("table SHOULD HAVE BEEN created successfully");
                    context.fail("Call failed, but resulted in creation of table. Retry your request.");
                }, 100);
            }
        });
    } else {
        context.fail(err);
    }
}