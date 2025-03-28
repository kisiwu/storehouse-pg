module.exports = {
  enableLogs: true,
  exitOnFail: true,
  files: 'test/lib',
  ext: '.test.js',
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
      port: process.env.TEST_DB_PORT,
      database: process.env.TEST_DB_NAME || 'ci',
      user: process.env.TEST_DB_USER || 'admin',
      password: process.env.TEST_DB_PASSWORD || '',
      ssl: false
    }
  },
};
