module.exports = {
  enableLogs: true,
  exitOnFail: true,
  files: 'test/lib',
  ext: 'js',
  options: {
    bail: false,
    fullTrace: true,
    grep: '',
    ignoreLeaks: false,
    reporter: 'spec',
    retries: 0,
    slow: 10000,
    timeout: 30000,
    ui: 'bdd',
    color: true,
  },
  parameters: {
    db: {
      host: process.env.TEST_DB_HOSTNAME || 'localhost',
      port: !isNaN(parseInt(process.env.TEST_DB_PORT)) ? parseInt(process.env.TEST_DB_PORT) : 5432,
      database: process.env.TEST_DB_NAME || 'defaultdb',
      schema: process.env.TEST_DB_SCHEMA || '',
      user: process.env.TEST_DB_USER || 'admin',
      password: process.env.TEST_DB_PASSWORD || ''
    }
  },
};
