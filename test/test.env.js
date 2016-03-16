process.env = {
    AWS_REGION: 'us-east-1',
    AWS_ACCESS_KEY: '',
    AWS_SECRET_KEY: '',
    RATE_LIMIT_WINDOW: '10',
    RATE_LIMIT_CONNECTIONS: '100',
    DYNAMO_ENDPOINT: 'dynamodb.us-east-1.amazonaws.com',
    ELK_LOGGER_HOST: 'localhost:9200',
    METRICS_HOST: 'ignore.localhost',
    JWT_HEADER: 'JWT',
    JWT_SECRET: 'tests-for-days',
    LOGGING_LEVEL: 'INFO',
    ENVIRONMENT: 'Tests',
    RUN_INTERVAL: 5,
    TEST_RUNNER: true,
    IP_ADDRESS: '127.0.0.1'
};
