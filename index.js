var app         = require('express')();
var forever     = require('forever');
var bodyParser  = require("body-parser");
var cookieParser = require('cookie-parser');
var urlHelper   = require('url');
var _           = require('underscore');
var guid        = require('guid');
var jwt         = require('jsonwebtoken');
var bbJWT       = require("bbjwt-client");

var AWS         = require('aws-sdk');
var crypto      = require('crypto');

var logger      = require('./util/logger');
var sdc         = require('./util/metrics');

var tasks       = require('./core/tasks');
var runner      = require('./core/runner');

//var SERVERID = uuid.v4();

process.on('uncaughtException',function(err){
    try
    {
        logger.logError('uncaughtException: '+err.message,err.stack);
    }
    catch (e)
    {
        console.log('uncaughtException: '+err.message,err.stack);
    }
    //process.exit(1);
});

if (process.env.IP_ADDRESS)
{
    app.listen(80, process.env.IP_ADDRESS);
}
app.enable('trust proxy');
app.use(bodyParser.urlencoded({ extended: false, limit: '50mb' }));
app.use(bodyParser.json({limit: '50mb'}));
app.use(cookieParser());
app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,BB-JWT');
    res.setHeader('Access-Control-Allow-Credentials', true);
    next();
});

app.get('/', function (req, res, next) {
    returnSuccess(res,'Snooze is up.');
});

app.post('/add', function (req, res, next) {

    var task = req.body.task;

    authenticate(req, res, function(jwt){

        // check requirements for adding a thing
        if (task)
        {

            tasks.addTask(task,function(err,taskId){
                if (err)
                {
                    logger.logError('Error occurred adding a task',task);
                    sdc.incrMetric('addTaskError');
                    returnErrorJson(res, { message: err, success: false });
                }
                else
                {
                    sdc.incrMetric('addTaskSuccess');
                    returnSuccessJson(res, { id: taskId, success: true, message: 'Task added' });
                }

            });

        }
        else
        {
            returnError(res, 'no task specified, wtf?!');
        }

    });


});

function authenticate(req, res, callback)
{
    var decodedToken = '';
    if (process.env.JWT_HEADER)
    {
        var token = req.get(process.env.JWT_HEADER);
        decodedToken = bbjwt.decodeToken(token);
        var reqIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        if (decodedToken === false)
        {
            sdc.incrMetric('userAuthenticationFailed');
            returnError(res, 'Invalid JWT from '+reqIP);
            return;
        }
    }
    callback && callback(decodedToken);
}

function returnError(res,err)
{
    res.status(500).end('crap '+err);
}

function returnErrorJson(res,result)
{
    res.status(500).json(result);
}

function returnSuccess(res,msg)
{
    res.status(200).end(msg);
}

function returnSuccessJson(res,result)
{
    res.status(200).json(result);
}



var child = new(forever.Forever)('core/runner.js', {
    max: 3,
    silent: true,
    args: []
});

child.on('exit', runnerExited);
child.start();

function runnerExited()
{

    console.log('Tell something that the main runner exited, please!');

}

exports.handler = app;


