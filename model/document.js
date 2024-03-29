var documentModel = exports;
var _ = require('underscore')._;
var util = require('util');
var vietntl = require('vietntl');
var tokenizer = new vietntl.Tokenizer();

documentModel.getDocuments = function(appId, callback) {
    var db = require('../db.js');
    
    db.mongoCollections.documents.find({ 'appId': appId }).toArray(function(err, results) {
        callback(0, results); 
    });
};

documentModel.getDocument = function(appId, documentId, callback) {
    var db = require('../db.js');
    
    db.mongoCollections.documents.find(
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

documentModel.insertDocument = function(newDocument, callback) {
    var db = require('../db.js');
    var api = require('../api.js');
    
    if (!newDocument.created) newDocument.created = api.now();
    
    db.mongoCollections.documents.insert(
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

documentModel.deleteDocument = function(document, callback) {
    var db = require('../db.js');

    db.mongoCollections.documents.findAndModify(
        { '_id': document._id },
        [], // sort
        {}, // update
        { 'remove': true }, // options
        function(err, result) {
            callback(err);
        }
    );
};

documentModel.countTokens = function(tokens) {
    var counts = {};
    
    _.each(tokens, function(token) {
        if (typeof counts[token] == 'undefined') counts[token] = 0;
        
        counts[token]++;
    });
    
    return counts;
}

documentModel.parseText = function(text, options) {
    _.defaults(options, {
         // this will set how tokens are merged together
         // with a value larger than 1, tokens will be merged
         // otherwise, the token list will be kept as is
        maxTokensToMerge: 1,
        
        // this will only return merged token (original tokens will be ignored)
        keepMergedOnly: false,
        
        // tokens that exists in the list will be removed 
        // from final result and not merged
        ignoredList: [
            'của', 'là', 'và', 'có', 'đã',
            'những', 'các', 'với',
            'cũng', 'đó', 'như', 'nhiều',
            'còn', 'mà', 'thế', 'đi', 'nhưng',
            'nhất', 'theo', 'sẽ',
            'đang', 'rất', 'hơn'
        ],
        
        // try to be smart or not?
        tryToBeSmart: 0
    });

    var tokenized = tokenizer.tokenize(text);
    var tokens = tokenized.tokens;
    text = tokenizer.normalize(text);

    // merge tokens to form new tokens
    if (options.maxTokensToMerge > 1) {
        var newTokens = documentModel._mergeTokens(
            text,
            // only send not ignored tokens
            _.difference(tokens, options.ignoredList),
            options.maxTokensToMerge
        );
        
        if (options.keepMergedOnly) {
            // ignore original tokens
            // without the special ones
            options.ignoredList = options.ignoredList.concat(_.difference(tokens, tokenized.special));
        }
        
        tokens = tokens.concat(newTokens);
    }
    
    if (options.tryToBeSmart) {
        tokens = documentModel._removeIrrelevantTokens(text, tokens, 50, options.ignoredList);
        // tokens = documentModel._removeSingleAppearTokens(tokens);
        // tokens = documentModel._removeCompoundTokens(tokens);
    }

    // filter out ignored tokens
    if (options.ignoredList.length > 0) {
        tokens = _.difference(tokens, options.ignoredList);
    }
    
    return tokens;
};

documentModel._mergeTokens = function(text, tokens, max) {
    var newTokens = [];
    var previous = [];
    
    _.each(tokens, function(token) {
        if (previous.length == 0) {
            // nothing to do yet
        } else {
            // start merging this token
            // with previous tokens
            for (var i = 0; i < previous.length; i++) {
                var tmp = previous.slice(i);
                tmp.push(token);
                tmp = tmp.join(' ');
                
                // check for the joined token
                // to make sure it exists in the text
                // 'exists' means there is only spaces (ASCII 32)
                // between the original tokens
                // also check to not mix number and non number
                if (text.indexOf(tmp) != -1 && !tokenizer.isMixedNumberAndNonNumber(tmp)) {
                    newTokens.push(tmp);
                }
            }
        }
        
        // keep this token in the previous array
        // to merge it later
        previous.push(token);
        
        if (previous.length >= max) {
            // too many token in the previous array
            // remove the oldest one
            previous.shift();
        }
    });
    
    return newTokens;
}

documentModel._removeSingleAppearTokens = function(tokens)
{
    var filtered = [];
    
    _.each(tokens, function(token) {
        var wordCount = token.split(' ').length;
        
        if (wordCount < 3) {
            // this method doesn't remove single-word or double-word tokens
            filtered.push(token);
        } else {
            var count = 0;
            _.each(tokens, function(token2) {
                if (token2 == token) {
                    count++;
                }
            });

            if (count > 1) {
                filtered.push(token);
            }
        }
    });
    
    return filtered;
}

documentModel._removeIrrelevantTokens = function(text, tokens, thresholdPercentage, ignoredTokens) {
    var irrelevantTokens = [];
    var processedTokens = [];
    
    _.each(tokens, function(token) {
        if (!_.include(processedTokens, token) /* && !_.include(ignoredTokens, token) */) {
            processedTokens.push(token);
            
            var tokensThatContainIt = [];
            var tokensThatContainItManyTime = [];
            var tokenCount = 0, offset, offset_tmp;
            var requiredCount = 0;

            // find all tokens that contain our token
            // this may catch some silly tokens
            _.each(tokens, function(token2) {
                if (token2 != token) {
                    offset_tmp = token2.indexOf(token);
                    if (offset_tmp != -1
                        && (offset_tmp == 0 || token2[offset_tmp - 1] == ' ')
                        && (offset_tmp == token2.length - token.length || token2[offset_tmp + token.length] == ' ')) {
                        tokensThatContainIt.push(token2);
                    }
                }
            });
            
            offset = 0;
            while (true) {
                offset_tmp = text.indexOf(token, offset);
                if (offset_tmp != -1) {
                    // found the token
                    offset = offset_tmp + 1;
                    tokenCount++;
                } else {
                    break; // while (true)
                }
            }

            if (tokensThatContainIt.length > 1) {
                // test all tokensThatContainIt to find the one that happen in more than 
                // threshold percent of tokensThatContainItMerged
                // only do this if we found more than 1 tokensThatContainItMerged
                requiredCount = tokenCount * thresholdPercentage / 100;

                _.each(tokensThatContainIt, function(token2) {
                    if (!_.include(tokensThatContainItManyTime, token2)) {
                        var token2Count = 0;
                        
                        offset = 0;
                        while (true) {
                            offset_tmp = text.indexOf(token2, offset);
                            if (offset_tmp != -1
                                && (offset_tmp == 0 || text[offset_tmp - 1] == ' ')
                                && (offset_tmp == text.length - token2.length || text[offset_tmp + 1] == ' ')) {
                                // found the token2
                                offset = offset_tmp + 1;
                                token2Count++;
                            } else {
                                break; // while (true)
                            }
                        }
                        
                        if (token2Count > 1 && token2Count >= requiredCount) {
                            tokensThatContainItManyTime.push(token2);
                        }
                    }
                });
            }
            
            if (tokensThatContainItManyTime.length > 0) {
                // there are other tokens that contain it and 
                // appear many time, it's likely that this token
                // is irrelevant...
                irrelevantTokens.push(token);
                
                // we also consider tokens that contain the token to be irrelevant
                // with the exception of tokens that contains tokens-that-contain-it-many-time 
                // make sense?
                var alsoIrrelevantTokens = [];
                _.each(tokensThatContainIt, function(token2) {
                    var inContainsManyTime = false;
                    
                    _.each(tokensThatContainItManyTime, function(token3) {
                        if (token2 == token3) {
                            inContainsManyTime = true;
                        } else {
                            offset_tmp = token2.indexOf(token3);
                            if (offset_tmp != -1
                                && (offset_tmp == 0 || token2[offset_tmp - 1] == ' ')
                                && (offset_tmp == token2.length - token3.length || token2[offset_tmp + token3.length] == ' ')) {
                                inContainsManyTime = true;
                            }
                        }
                    });
                    
                    if (!inContainsManyTime) {
                        alsoIrrelevantTokens.push(token2);
                    }
                });

                irrelevantTokens = irrelevantTokens.concat(alsoIrrelevantTokens);
            }
        }
    });

    return _.difference(tokens, irrelevantTokens);
}

documentModel._removeCompoundTokens = function(tokens)
{
    var compoundTokens= [];
    
    _.each(tokens, function(token) {
        if (token.indexOf(' ') != -1 && !_.include(compoundTokens, token)) {
            var containedTokens = [];
            
            _.each(tokens, function(token2) {
                if (token2 != token && token2.indexOf(' ') != -1 && !_.include(containedTokens, token2)) {
                    if (token.indexOf(token2) != -1) {
                        containedTokens.push(token2);
                    }
                }
            });
            
            if (containedTokens.length == 1) {
                compoundTokens.push(token);
            }
        }
    });

    return _.difference(tokens, compoundTokens);
}

documentModel.search = function(appId, sections, words, callback) {
    var db = require('../db.js');

    var mapf = function() {
        var wordsFound = [];
        var result = 0;
        
        if (g_sections && g_sections.length > 0) {
            // some sections are specified
            var sectionFound = false;
            
            for (var i in g_sections) {
                for (var j in this.sections) {
                    if (g_sections[i] == this.sections[j]) {
                        sectionFound = true;
                        break; // for (var j in this.sections)
                    }
                }
                
                if (sectionFound) {
                    break; // for (var i in g_sections)
                }
            }
            
            if (!sectionFound) {
                // no section matched
                // skip!
                return;
            }
        }

        for (var i in g_words) {
            var found = false;
            for (var j in this.words) {
                if (g_words[i] == this.words[j]) {
                    found = true;
                    break; // for (var j in this.words)
                }
            }
            
            if (found) {
                wordsFound.push(g_words[i]);
                // break; // for (var i in g_words)
            }
        }
        
        if (g_words.length > 0) {
            result = wordsFound.length / g_words.length;
        }
        
        //if (result > g_resultThreshold) {
        if (wordsFound.length > 0) {
            emit(this._id, {'result': result, 'words': wordsFound});
        }
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
            'g_sections': sections,
            'g_words': words,
            'g_resultThreshold': 0.2
        }
    };
    
    db.mongoDb.executeDbCommand(command, function(err, res) {
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
        
        found = _.sortBy(found, function(record) {
            return 1 - record.value.result;
        });
        
        if (found.length > 50) {
            // TODO: not hardcode 5
            found = found.slice(0, 50);
        }

        callback(err, found);
    });
};