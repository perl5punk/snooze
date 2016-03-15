
var https       = require('https');
var urlParser   = require('url');

var logger      = require('../util/logger');
var tasks       = require('./tasks');

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
        tasks.setStatus(task.id, tasks.RUNNING);
        var childProcess = fork('./core/runtask',[{ task: task }]);
        childProcess.send({ task: task });
        childProcess.on('message', function(msg,task) {

            // this will be logged
            console.info(msg,task);

            if (msg.result)
            {
                task.updateTask(task.id, { result: msg.result });
            }

        });
        childProcess.on('error', function(err) {

            // this will be logged
            console.error(err);
            if (err)
            {
                task.updateTask(task.id, { error: err });
            }

        });
        childProcess.on('exit', function(code) {

            if (code)
            {

                // might need to clean-up tasks if it didn't exit successfully
                console.log("exit; child runtask exited, NO GOOD "+code);
                tasks.setStatus(task.id, code, function(err,data){

                    console.log("exit; child runtask exit status set "+err,data);

                });

            }
            else
            {
                tasks.setStatus(task.id, tasks.SUCCESS, function(err,data){

                    console.log("exit; child runtask exit status set "+err,data);

                });
                console.log("exit; child runtask exited, all good");
            }

        });
        childProcess.on('close', function(code) {

            if (code)
            {

                // might need to clean-up tasks if it didn't exit successfully
                console.log("child runtask exited, NO GOOD "+code);
                tasks.setStatus(task.id, code, function(err,data){

                    console.log("child runtask exit status set "+err,data);

                });

            }
            else
            {
                tasks.setStatus(task.id, tasks.SUCCESS, function(err,data){

                    console.log("child runtask exit status set "+err,data);

                });
                console.log("child runtask exited, all good");
            }

        });

        console.log("runtask started");
    }
    else
    {
        console.error('Start called with no task..?');
    }

};

module.exports = new Runner();