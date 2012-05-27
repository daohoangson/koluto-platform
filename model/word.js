var wordModel = exports;
var _ = require('underscore')._;
var util = require('util');
var db = require('../db.js');

wordModel._getAppWordSetKey = function(appId) {
    return util.format('aws_%s', appId);
};

wordModel._getAppSectionWordSetKey = function(appId, section) {
    return util.format('astws_%s_%s', appId, section);
};

wordModel._getAppWordHashKey = function(appId, word) {
    return util.format('awh_%s_%s', appId, word);
};

wordModel._getWordHashKeyAppKey = function() {
    // it's safe to do this because
    // we know for a fact that the '_' character
    // will never make it to a section key (see below)
    return '_app';
};

wordModel._getWordHashKeySectionKey = function(section) {
    return 's_' + section;
};

wordModel.getAppWords = function(appId, options, callback) {
    var offset = (options && options.offset) ? options.offset : 0;
    var limit = (options && options.limit) ? options.limit : 500;
    
    db.redisClient.sort(wordModel._getAppWordSetKey(appId), 'by', wordModel._getAppWordHashKey(appId, '*') + '->' + wordModel._getWordHashKeyAppKey(), 'limit', offset, limit, 'desc', function(err, results) {
        if (err) {
            // there is some error, exit asap
            callback(err, results);
            return;
        }

        callback(err, results);
    });
};

wordModel.getAppWord = function(appId, word, callback) {
    db.redisClient.HGETALL(wordModel._getAppWordHashKey(appId, word), function(err, res) {
        if (!err) {
            callback(err, res);
        } else {
            callback(err, {});
        }
    });
}

wordModel.incrWord = function(appId, word, sections, count, callback) {
    db.redisClient.sadd(wordModel._getAppWordSetKey(appId), word, function() {
        db.redisClient.hincrby(wordModel._getAppWordHashKey(appId, word), wordModel._getWordHashKeyAppKey(), count, function() {
            if (sections && sections.length > 0) {
                // the parent document has some section defined
                _.each(sections, function(section) {
                    db.redisClient.sadd(wordModel._getAppSectionWordSetKey(appId, section), word);
                    db.redisClient.hincrby(wordModel._getAppWordHashKey(appId, word), wordModel._getWordHashKeySectionKey(section), count);
                })
            }
            
            if (callback) {
                callback();
            }
        });
    });
};

// Sections related...
wordModel.getAppSectionWords = function(appId, section, options, callback) {
    var offset = (options && options.offset) ? options.offset : 0;
    var limit = (options && options.limit)? options.limit : 500;

    db.redisClient.sort(wordModel._getAppSectionWordSetKey(appId, section), 'by', wordModel._getAppWordHashKey(appId, '*') + '->' + wordModel._getWordHashKeySectionKey(section), 'limit', offset, limit, 'desc', function(err, results) {
        if (err) {
            // there is some error, exit asap
            callback(err, results);
            return;
        }

        callback(err, results);
    });
};