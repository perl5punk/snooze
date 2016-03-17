
var https       = require('https');
var AWS         = require('aws-sdk');
var tasks       = require('./tasks');

var snsParameters = { region: process.env.AWS_REGION };
if (process.env.AWS_ACCESS_KEY)
{
    snsParameters.accessKeyId = process.env.AWS_ACCESS_KEY;
    snsParameters.secretAccessKey = process.env.AWS_SECRET_KEY;
}
var sns = new AWS.SNS(snsParameters);

process.on('message', function(task){

    console.log('CHILD got message:', task);

    if (task)
    {

        if (task.url)
        {
            var httpRequest = https.get(task.url, function(res) {

                var body = [];
                console.log('statusCode: ', res.statusCode);
                console.log('headers: ', res.headers);

                res.on('data', function(chunk) {
                    body.push(chunk);
                }).on('end', function() {
                    body = body.toString();

                    console.log(body);
                    process.send({ result: body });
                    process.exit(0);

                });

            });
            httpRequest.end();
            httpRequest.on('error', function(e) {

                process.send({ result: 'I ran a task url, got an error... '+e });
                process.exit(tasks.ERROR);

            });

        }
        else if (task.snsTarget)
        {
            var parameters = {
                TargetArn: task.snsTarget,
                Message: JSON.stringify(task.payload),
                Subject: 'SnoozeNotification'
            };
            sns.publish(parameters,function(err,data){
                if (err)
                {
                    process.send({ result: 'I published an SNS, got an error... '+err });
                    process.exit(tasks.ERROR);
                }
                else
                {
                    process.send({ result: 'I published a task SNS... '+data });
                    process.exit(0);
                }
            });
        }
        else
        {
            process.send({ result: 'not sure which task to run '+task });
            process.exit(tasks.UNKNOWN);
        }

    }
    else
    {
        process.exit(tasks.UNKNOWN);
    }

});



