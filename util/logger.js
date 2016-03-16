var elkLogger = require('node-elk-logger');

if (!process.env.ELK_LOGGER_HOST)
{
    elkLogger.log = function(message, type, payload){
        if (type == 'ERROR')
        {
            console.error(type+': '+message, payload);
        }
        else
        {
            console.log(type+': '+message, payload);
        }
    };
}
else
{
    elkLogger.configure({
        host: process.env.ELK_LOGGER_HOST,
        elasticSearchIndexPrefix: 'snooze',
        messageDecorations: { environment: process.env.ENVIRONMENT },
        level: process.env.LOGGING_LEVEL,
        logToConsole: (process.env.ENVIRONMENT != 'Production')
    });
}

module.exports = elkLogger;