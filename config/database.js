require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    host: process.env.DB_HOST,
    port: 5432,
    dialect: 'postgres',
    connectionTimeout: 0,
    pool: {
      max: 1,
      min: 1,
      idle: 200000,
      acquire: 200000
    },
    logging: true,
    operatorsAliases: false
  },
  test: {
    username: 'postgres',
    password: 'bismillah',
    database: 'test-admin-hub',
    host: '127.0.0.1',
    port: 5432,
    dialect: 'postgres',
    connectionTimeout: 0,
    pool: {
      max: 1,
      min: 1,
      idle: 200000,
      acquire: 200000
    },
    logging: true
  },
  production: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: 5432,
    host: process.env.DB_HOST,
    dialect: 'postgres',
    connectionTimeout: 0,
    pool: {
      max: 1,
      min: 1,
      idle: 200000,
      acquire: 200000
    },
    logging: true,
    ssl: true,
    dialectOptions: {
      ssl: true
    }
  }
};
