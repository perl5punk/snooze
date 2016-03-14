var elkLogger = require('node-elk-logger');

elkLogger.configure({
    host: process.env.ELK_LOGGER_HOST,
    elasticSearchIndexPrefix: 'snooze',
    messageDecorations: { environment: process.env.ENVIRONMENT },
    level: process.env.LOGGING_LEVEL,
    logToConsole: (process.env.ENVIRONMENT != 'Production')
});

module.exports = elkLogger;