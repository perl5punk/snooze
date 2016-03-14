var AWS = require('aws-sdk');

var snsParameters = { region: process.env.AWS_REGION };
if (process.env.AWS_ACCESS_KEY)
{
    snsParameters.accessKeyId = process.env.AWS_ACCESS_KEY;
    snsParameters.secretAccessKey = process.env.AWS_SECRET_KEY;
}
var sns = new AWS.SNS(snsParameters);



