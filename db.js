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

// redis keys
db._getAppWordSetKey = function(appId) {
    return util.format('aws_%s', appId);
};

db._getAppSectionWordSetKey = function(appId, section) {
    return util.format('astws_%s_%s', appId, section);
};

db._getAppWordHashKey = function(appId, word) {
    return util.format('awh_%s_%s', appId, word);
};

db._getWordHashKeyAppKey = function() {
    // it's safe to do this because
    // we know for a fact that the '_' character
    // will never make it to a section key (see below)
    return '_app';
};

db._getWordHashKeySectionKey = function(section) {
    return 's_' + section;
};

// Word related...
db.getAppWords = function(appId, options, callback) {
    var offset = (options && options.offset) ? options.offset : 0;
    var limit = (options && options.limit) ? options.limit : 500;
    
    redisClient.sort(db._getAppWordSetKey(appId), 'by', db._getAppWordHashKey(appId, '*') + '->' + db._getWordHashKeyAppKey(), 'limit', offset, limit, 'desc', function(err, results) {
        if (err) {
            // there is some error, exit asap
            callback(err, results);
            return;
        }

        callback(err, results);
    });
};

db.getAppWord = function(appId, word, callback) {
    redisClient.HGETALL(db._getAppWordHashKey(appId, word), function(err, res) {
        if (!err) {
            callback(err, res);
        } else {
            callback(err, {});
        }
    });
}

db.incrWord = function(appId, word, sections, count, callback) {
    redisClient.sadd(db._getAppWordSetKey(appId), word, function() {
        redisClient.hincrby(db._getAppWordHashKey(appId, word), db._getWordHashKeyAppKey(), count, function() {
            if (sections && sections.length > 0) {
                // the parent document has some section defined
                _.each(sections, function(section) {
                    redisClient.sadd(db._getAppSectionWordSetKey(appId, section), word);
                    redisClient.hincrby(db._getAppWordHashKey(appId, word), db._getWordHashKeySectionKey(section), count);
                })
            }
            
            if (callback) {
                callback();
            }
        });
    });
};

// Sections related...
db.getAppSectionWords = function(appId, section, options, callback) {
    var offset = (options && options.offset) ? options.offset : 0;
    var limit = (options && options.limit)? options.limit : 500;

    redisClient.sort(db._getAppSectionWordSetKey(appId, section), 'by', db._getAppWordHashKey(appId, '*') + '->' + db._getWordHashKeySectionKey(section), 'limit', offset, limit, 'desc', function(err, results) {
        if (err) {
            // there is some error, exit asap
            callback(err, results);
            return;
        }

        callback(err, results);
    });
};

db.findSimilarDocuments_getFingerprint = function(text) {
    var textPreprocessed = text.replace(/\s+/g, '', text).toLowerCase();
    var i = 0;
    var l = text.length;
    var n = 3;
    var s = 6;
    var fingerprint = [];

    while (i < l) {
        fingerprint.push(text.substr(i, n)); // get n-gram
        
        i += s; // go forward
    }

    return fingerprint;
};

db.findSimilarDocuments_compareFingerprints = function(fp1, fp2) {
    var l1 = fp1.length;
    var l2 = fp2.length;
    var count = 0;

    if (l1 == 0 || l2 == 0) return 0; // do not compare empty fingerprints

    for (var i1 = 0; i1 < l1; i1++) {
        for (var i2 = 0; i2 < l2; i2++) {
            if (fp1[i1] == fp2[i2]) {
                count++;
                break; // i2 loop
            }
        }
    }

    return count/l1;
};

db.findSimilarDocuments = function(appId, text, callback) {
    var mapf = function() {
        if (typeof getFingerprint != 'function') {
            // define the global function getFingerprint
            eval('getFingerprint = ' + g_getFingerprint);
        }
        if (typeof compareFingerprints != 'function') {
            // define the global function compareFingerprints
            eval('compareFingerprints = ' + g_compareFingerprints);
        }

        var fpThis = getFingerprint(this.text);
        var fpText = getFingerprint(g_text);
        emit(this._id, compareFingerprints(fpThis, fpText));
    };
    var reducef = function(key, values) {
        // get the first value and return it
        for (var i in values) {
            return values[i];
        }
    };

    var command = {
        mapreduce: 'documents',
        out: {inline: 1},
        query: {'appId': appId},
        map: mapf.toString(),
        reduce: reducef.toString(),
        scope: {
            'g_text': text,
            'g_getFingerprint': db.findSimilarDocuments_getFingerprint.toString(),
            'g_compareFingerprints': db.findSimilarDocuments_compareFingerprints.toString()
        }
    };
    mongoDb.executeDbCommand(command, function(err, res) {
        var found = [];

        if (typeof res.documents != 'undefined') {
            for (var i in res.documents) {
                if (typeof res.documents[i].results != 'undefined') {
                    for (var j in res.documents[i].results) {
                        found.push(res.documents[i].results[j]);
                    }
                }
            }
        }

        callback(err, found);
    });
};