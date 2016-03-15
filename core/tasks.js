var AWS = require('aws-sdk');
var doc = require('dynamodb-doc');
var _ = require('underscore');
var guid = require('guid');

var ddbTableName = process.env.ENVIRONMENT + '_SnoozeTasks';

function Tasks(logInstance)
{

    var tasks = this;
    var dynamo = new AWS.DynamoDB({
        endpoint: process.env.DYNAMO_ENDPOINT,
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY,
        region: process.env.AWS_REGION
    });

    this.dynamo = new doc.DynamoDB(dynamo);

    var params = {
        TableName: this.getDbTableName()
    };

    this.PENDING = 0;
    this.RUNNING = 1;
    this.CANCELED = 2;
    this.ERROR = 3;
    this.SUCCESS = 9;
    this.UNKNOWN = 11;

    this.dynamo.describeTable(params, function(err, data) {
        if (err){
            console.log(err, err.stack);
            tasks.makeTable();
            tasks.dynamo.waitFor('tableExists', params, function(err, data) {
                if (err)
                {
                    console.error(err, err.stack);
                }
                else
                {
                    console.log(data);
                }
            });
        }
        else {
            console.log('Tasks: '+params.TableName+' exists.');
        }
    });

}

Tasks.prototype.addTask = function(task,callback)
{

    var dynamo = this.getDynamo();
    if (typeof task == "string")
    {
        task = JSON.parse(task);
    }

    var itemRecord = _.extend({
        id: guid.create().value,
        ts: 0,
        status: 0,
        added_timestamp: Math.floor(Date.now()/1000)
    },task);

    if (typeof itemRecord.ts == "string")
    {
        itemRecord.ts = parseInt(itemRecord.ts);
    }

    if (!itemRecord.ts)
    {
        callback('no run timestamp specified',null);
    }
    else if (itemRecord.ts < itemRecord.added_timestamp)
    {
        callback('task start time is in the past '+itemRecord.ts +' < '+ itemRecord.added_timestamp+', come on, man!',null);
    }
    else
    {
        dynamo.putItem({
            TableName: this.getDbTableName(),
            Item: itemRecord
        },
        function(err,data){
            var newId = itemRecord.id;
            var errorMessage = '';
            if (err)
            {
                errorMessage = err.message;
                console.info('Tasks; error adding a task',err);

            }
            else
            {
                console.info('Tasks; added a new task! '+newId,data);
            }
            callback(errorMessage,newId);
        });
    }

};

Tasks.prototype.updateTask = function(id,attributes,callback)
{

    attributes.updated_time = Math.floor(Date.now()/1000);

    var updateItem = {
            TableName:this.getDbTableName(),
            Key: {
                id: id
            },
            UpdateExpression: 'set ',
            ExpressionAttributeNames: {},
            ExpressionAttributeValues: {}
        };

    for (var x in attributes)
    {
        if (!attributes.hasOwnProperty(x)) continue;
        updateItem.UpdateExpression += '#'+x+' = :'+x+', ';
        updateItem.ExpressionAttributeNames['#'+x] = x;
        updateItem.ExpressionAttributeValues[':'+x] = attributes[x];
    }
    updateItem.UpdateExpression = updateItem.UpdateExpression.substr(0, updateItem.UpdateExpression.length-2);

    this.dynamo.updateItem(updateItem, callback);

};

Tasks.prototype.setStatus = function(id,status,callback)
{
    callback = callback || function(err,data){};
    this.updateTask(id, { status: status }, callback);
};

Tasks.prototype.getTasks = function(queryOptions, callback)
{

    if (!queryOptions.KeyConditions || !queryOptions.IndexName)
    {
        callback('KeyConditions and IndexName are Required',null);
    }

    queryOptions.TableName = this.getDbTableName();

    this.dynamo.query(queryOptions,function(err, data) {
        callback(err, data);
    });

};

Tasks.prototype.getTasksToRun = function(callback)
{

    var nowTs = Math.floor(Date.now()/1000);
    this.getTasks({
        IndexName: 'status-ts-index',
        KeyConditions: [
            this.dynamo.Condition("ts", "LE", nowTs),
            this.dynamo.Condition("status", "EQ", 0)
        ]
    },callback);

};

Tasks.prototype.getDynamo = function() {
    return this.dynamo;
};

Tasks.prototype.getDocumentStore = function() {
    var DOC = require("dynamodb-doc");
    return new DOC.DynamoDB(this.getDynamo());
};

Tasks.prototype.getDbTableName = function() {
    return ddbTableName;
};

Tasks.prototype.makeTable = function()
{

    var dynamo = this.getDynamo(),
        params = {
        TableName: this.getDbTableName(),
        AttributeDefinitions: [
            {AttributeName: 'id',       AttributeType: 'S'},
            {AttributeName: 'ts',       AttributeType: 'N'},
            {AttributeName: 'status',   AttributeType: 'N'}
        ],
        KeySchema: [
            { AttributeName: 'id',   KeyType: 'HASH' }
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 10
        },
        GlobalSecondaryIndexes: [
            {
                IndexName: 'status-ts-index',
                KeySchema: [
                    {AttributeName: 'status',   KeyType: 'HASH'},
                    {AttributeName: 'ts',       KeyType: 'RANGE'}
                ],
                Projection: {
                    ProjectionType:'ALL'
                },
                ProvisionedThroughput: {
                    ReadCapacityUnits: 5,
                    WriteCapacityUnits: 10
                }
            }
        ]
    };

    dynamo.createTable(params, function(err, data) {
        if (err)
        {
            console.error(err);
        }
        else
        {
            console.log('Made Table:'+data);
        }
    });

};

function initDynamoIfNeeded(err, context) {

    if (err.name === 'ResourceNotFoundException') {

        console.log("Creating Dynamo table "+this.getDbTableName());


    } else {
        context.fail(err);
    }
}

module.exports = new Tasks();




