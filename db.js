var db = exports;
var util = require('util');
var _ = require('underscore')._;
var config = require('./config').config;
var api = require('./api');
var mongodb = require('mongodb');
var mysql = require('mysql');
var redis = require('redis');

// setup MongoDB connection
var mongoServer = new mongodb.Server(config.DB_MONGO_HOST, config.DB_MONGO_PORT, {});
db.mongoDb = new mongodb.Db(config.DB_MONGO_DATABASE, mongoServer, {});
db.mongoCollections = {};
db.mongoDb.open(function(err, mongoClient) {
    if (err) {
        console.log('Database/MongoDB failed', err);
        process.exit(1);
    } else {
        db.mongoCollections.documents = new mongodb.Collection(mongoClient, 'documents');
        console.log('Database/MongoDB ready');   
    }
});

// setup Redis connection
db.redisClient = redis.createClient(config.DB_REDIS_PORT, config.DB_REDIS_HOST, {});
db.redisClient.on('ready', function() {
    console.log('Database/Redis ready');
});
db.redisClient.on('error', function(err) {
    console.log('Database/Redis failed', err);
    process.exit(1);
})

// setup MySQL connection (and create table if needed)
db.mysqlClient = mysql.createClient({
    'host': config.DB_MYSQL_HOST,
    'port': config.DB_MYSQL_PORT,
    'user': config.DB_MYSQL_USER,
    'password': config.DB_MYSQL_PASSWORD
    // 'database': config.DB_MYSQL_DATABASE -- to be created on first use
});
var mysqlCreateTables = function(callback) {
    db.mysqlClient.query(
        'CREATE TABLE IF NOT EXISTS user'
        + '(app_id INT(10) UNSIGNED AUTO_INCREMENT,'
        + 'username VARCHAR(255) NOT NULL,'
        + 'password VARCHAR(255) NOT NULL,'
        + 'email TEXT,'
        + 'created INT(10) UNSIGNED NOT NULL,'
        + 'PRIMARY KEY(app_id),'
        + 'UNIQUE KEY(username))'
        , function() {
            callback();
        }
    );
};
db.mysqlClient.query('CREATE DATABASE ' + config.DB_MYSQL_DATABASE, function(err) {
    var isOk = true;
    var readyCallback = function(err) {
        if (err) {
            console.log('Database/MySQL failed', err);
            process.exit(1);
        } else {
            console.log('Database/MySQL ready');
        }
    }
    
    if (err && err.number != mysql.ERROR_DB_CREATE_EXISTS) {
        readyCallback(err);
    } else {
        db.mysqlClient.useDatabase(config.DB_MYSQL_DATABASE, function() {
            mysqlCreateTables(readyCallback);
        });
    }
});