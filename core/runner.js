
var AWS = require('aws-sdk');

var https = require('https');
var urlParser = require('url');

var tasks = require('./tasks');

const fork = require('child_process').fork;

var seekInterval = ((process.env.RUN_INTERVAL || 5) * 1000); // 5 second default

function Runner()
{

    var me = this;
    var runTimer = setInterval(function(){
        me.startTasksToRun();
    },seekInterval);

}

Runner.prototype.startTasksToRun = function()
{

    var me = this;
    tasks.getTasksToRun(function(err,data){
        if (!err)
        {
            var tasks = data.Items;
            for (var i = 0; i < tasks.length; i++)
            {
                me.startTask(tasks[i]);
            }
        }
        else
        {
            console.error('startTasksToRun for getTasksToRun '+err);
        }
    });

};

Runner.prototype.startTask = function(task)
{

    if (task)
    {
        var childProcess = fork('./core/runtask',[{ task: task }]);
        childProcess.on('close', function(code) {

            if (code)
            {

                // might need to clean-up tasks if it didn't exit successfully
                console.log("child runtask exited, NO GOOD "+code);

            }
            else
            {
                console.log("child runtask exited, all good");
            }

        });
    }
    else
    {
        console.error('Start called with no task..?');
    }

};

module.exports = new Runner();