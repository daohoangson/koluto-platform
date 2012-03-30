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
var mongoDb = new mongodb.Db(config.DB_MONGO_DATABASE, mongoServer, {});
var mongoCollections = {};
mongoDb.open(function(err, mongoClient) {
    if (err) {
        console.log('Database/MongoDB failed', err);
        process.exit(1);
    } else {
        mongoCollections.documents = new mongodb.Collection(mongoClient, 'documents');
        console.log('Database/MongoDB ready');   
    }
});

// setup Redis connection
var redisClient = redis.createClient(config.DB_REDIS_PORT, config.DB_REDIS_HOST, {});
redisClient.on('ready', function() {
    console.log('Database/Redis ready');
});
redisClient.on('error', function(err) {
    console.log('Database/Redis failed', err);
    process.exit(1);
})

// setup MySQL connection (and create table if needed)
var mysqlClient = mysql.createClient({
    'host': config.DB_MYSQL_HOST,
    'port': config.DB_MYSQL_PORT,
    'user': config.DB_MYSQL_USER,
    'password': config.DB_MYSQL_PASSWORD
    // 'database': config.DB_MYSQL_DATABASE -- to be created on first use
});
var mysqlCreateTables = function(callback) {
    mysqlClient.query(
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
mysqlClient.query('CREATE DATABASE ' + config.DB_MYSQL_DATABASE, function(err) {
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
        mysqlClient.useDatabase(config.DB_MYSQL_DATABASE, function() {
            mysqlCreateTables(readyCallback);
        });
    }
});

// User related...
db.getUserByUserName = function(userName, callback) {
    mysqlClient.query(
        'SELECT * FROM user WHERE username = ?',
        [userName],
        function(err, results, fields) {
            if (err) {
                callback(err);
            } else if (results.length != 1) {
                callback(0, null)
            } else {
                callback(0, results[0]);
            }
        }
    );
}

db.insertUser = function(newUser, callback) {
    mysqlClient.query(
        'INSERT INTO user '
        + 'SET username = ?, '
        + 'password = ?, '
        + 'email = ?, '
        + 'created = ?'
        , [newUser.username, newUser.password, newUser.email, api.now()]
        , function(err, info) {
            if (err) {
                callback(err);
            } else {
                callback(0, info.insertId);
            }
        }
    );
}

// Document related...
db.getDocuments = function(appId, callback) {
    mongoCollections.documents.find({ 'appId': appId }).toArray(function(err, results) {
        callback(0, results); 
    });
};

db.getDocument = function(appId, documentId, callback) {
    mongoCollections.documents.find(
        {
            'appId': appId,
            '_id': new mongodb.ObjectID(documentId)
        }
    ).toArray(function(err, results) {
        if (err) {
            callback(err);
            return;
        }

        callback(0, results[0]);
    });
};

db.insertDocument = function(newDocument, callback) {
    if (!newDocument.created) newDocument.created = api.now();
    
    mongoCollections.documents.insert(
        newDocument,
        { safe: true }, // options
        function(err, results) {
            if (err) {
                callback(err);
                return;
            }
            
            callback(err, results[0]);
        }
    );
};

db.deleteDocument = function(document, callback) {
    mongoCollections.documents.findAndModify(
        { '_id': document._id },
        [], // sort
        {}, // update
        { 'remove': true }, // options
        function(err, result) {
            callback(err);
        }
    );
};

// Word related...
db.getAppWords = function(appId, callback) {
    redisClient.sort(db._getAppWordSetKey(appId), 'by', db._getAppWordKey(appId, '*'), 'limit', 0, 100, 'desc', function(err, results) {
        if (err) {
            // there is some error, exit asap
            callback(err, results);
            return;
        }

        callback(err, results);
    });
};

db.getAppWord = function(appId, word, callback) {
    redisClient.get(db._getAppWordKey(appId, word), function(err, globalCount) {
        if (!err && globalCount > 0) {
            // this word actually exists in db
            var result = {
                'word': word,
                'global_count': globalCount,
                'sections': [],
            }
            
            var sectionKeyPattern = db._getAppWordSectionKey(appId, word, '*');
            var sectionKeyPatternParts = sectionKeyPattern.split('*');
            
            redisClient.keys(sectionKeyPattern, function(err, keys) {
                if (!err && keys && keys.length > 0) {
                    // we found some sections with this word
                    var lastKey = _.last(keys);
                    _.each(keys, function(key) {
                        redisClient.get(key, function(err, sectionCount) {
                            // TODO: improve this
                            var sectionName = key;
                            sectionName = sectionName.replace(sectionKeyPatternParts[0], '');
                            sectionName = sectionName.replace(sectionKeyPatternParts[1], '');
                            
                            result.sections.push({
                                'section_id': sectionName,
                                'section_count': sectionCount
                            });
                            
                            if (key == lastKey) {
                                // assuming all redis call return after similar delay
                                // we will issue callback when the last section is processed
                                result.sections = _.sortBy(result.sections, function(section) {
                                    return section.section_id;
                                }).reverse();

                                callback(err, result);
                            }
                        });
                    })
                } else {
                    callback(err, result);
                }
            })
        } else {
            callback(err, {});
        }
    });
}

db.incrAppWord = function(appId, word, sections, callback) {
    redisClient.sadd(db._getAppWordSetKey(appId), word, function() {
        redisClient.incr(db._getAppWordKey(appId, word), function() {
            if (sections && sections.length > 0) {
                // the parent document has some section defined
                _.each(sections, function(section) {
                    redisClient.sadd(db._getAppSectionWordSetKey(appId, section), word);
                    redisClient.incr(db._getAppWordSectionKey(appId, word, section));
                })
            }
            
            if (callback) {
                callback();
            }
        });
    });
};

db._getAppWordSetKey = function(appId) {
    return util.format('aws_%s', appId);
}

db._getAppSectionWordSetKey = function(appId, section) {
    return util.format('astws_%s_%s', appId, section);
}

db._getAppWordKey = function(appId, word) {
    return util.format('as_%s_%s', appId, word);
}

db._getAppWordSectionKey = function(appId, word, section) {
    return util.format('awst_%s_%s_%s', appId, word, section);
}

// Sections related...
db.getAppSection = function(appId, section, callback) {
    redisClient.sort(db._getAppSectionWordSetKey(appId, section), 'by', db._getAppWordSectionKey(appId, '*', section), 'limit', 0, 100, 'desc', function(err, results) {
        if (err) {
            // there is some error, exit asap
            callback(err, results);
            return;
        }

        callback(err, results);
    });
}