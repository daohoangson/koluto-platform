var documentModel = exports;
var _ = require('underscore')._;
var util = require('util');
var vietntl = require('vietntl');
var tokenizer = new vietntl.Tokenizer();
var db = require('../db.js');
var api = require('../api.js');

documentModel.getDocuments = function(appId, callback) {
    db.mongoCollections.documents.find({ 'appId': appId }).toArray(function(err, results) {
        callback(0, results); 
    });
};

documentModel.getDocument = function(appId, documentId, callback) {
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
    defaultOptions = {
         // this will set how tokens are merged together
         // with a value larger than 1, tokens will be merged
         // otherwise, the token list will be kept as is
        maxTokensToMerge: 1,
        
        // this will only return merged token (original tokens will be ignored)
        keepMergedOnly: false,
        
        // tokens that exists in the list will be removed 
        // from final result
        ignoredList: [
            'của', 'là', 'và', 'có', 'được', 'người', 'đã', 'không', 'trong',
            'cho', 'những', 'các', 'với', 'này', 'để', 'ông', 'ra', 'khi', 'lại',
            'đến', 'về', 'nhà', 'vào', 'cũng', 'làm', 'từ', 'đó', 'như', 'nhiều',
            'sau', 'bị', 'tại', 'anh', 'phải', 'con', 'sự',
            'tôi', 'việc', 'thì', 'chỉ', 'trên',
            'còn', 'mà', 'thế', 'ngày', 'đi', 'nhưng', 'hiện',
            'hàng', 'nhất', 'số', 'điều', 'theo', 'sẽ', 'bà',
            'đang', 'cả', 'biết', 'mình', 'trước', 'vì', 'chị',
            'rất', 'lên', 'rằng', 'nói', 'hơn', 'một', 'khác', 'chúng',
            'đây',
            // since 20-04-2012
            'do', 'khá',
        ],
        
        // try to be smart or not?
        tryToBeSmart: 0
    };
    var options = options || {};
    _.defaults(options, defaultOptions);
    
    // convert to lowercase
    text = text.toLowerCase();
    // replace multiple spaces with one space
    text = text.replace(/\s+/g, ' ');
    
    var tokens = tokenizer.tokenize(text);
    
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
            options.ignoredList = options.ignoredList.concat(tokens);
        }
        
        tokens = tokens.concat(newTokens);
    }

    if (options.tryToBeSmart) {
        // tokens = documentModel._removeSingleAppearTokens(tokens);
        tokens = documentModel._removeIrrelevantTokens(text, tokens, 50);
        // tokens = documentModel._removeCompoundTokens(tokens);
    }
    
    // filter out ignored tokens
    if (options.ignoredList.length > 0) {
        tokens = _.difference(tokens, options.ignoredList);
    }
    
    return tokens
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

documentModel._removeIrrelevantTokens = function(text, tokens, thresholdPercentage) {
    var irrelevantTokens = [];
    
    _.each(tokens, function(token) {
        if (!_.include(irrelevantTokens, token)) {
            var tokensThatContainIt = [];
            var tokensThatContainItMerged = [];
            var tokensThatContainItMergedPositions = [];
            var tokensThatContainItManyTime = [];
            var requiredCount = 0;

            // find all tokens that contain our token
            // this may catch some silly tokens
            _.each(tokens, function(token2) {
                if (token2 != token && token2.indexOf(token) != -1) {
                    tokensThatContainIt.push(token2);
                }
            });

            // look for the tokensThatContainIt in the text
            // and try to merge them if possible
            // the loop is simple because all the time, our tokens will
            // be in the form of "AAA BBB CCC" and "BBB CCC DDD"
            // we also assume these tokens will be unique in the textå
            _.each(tokensThatContainIt, function(token2) {
                var offset = 0;
                while (true) {
                    var startPos = text.indexOf(token2, offset);
                    if (startPos == -1) break; // while (true)
                    offset = startPos + 1;
                    
                    var isMerged = false;
                    _.each(tokensThatContainItMergedPositions, function(positions) {
                        if (startPos >= positions[0] && startPos < positions[1]) {
                            isMerged = true;
                        }
                    });
                    
                    if (!isMerged) {
                        var endPos = startPos + token2.length;

                        _.each(tokensThatContainIt, function(token3) {
                            if (token3 != token2) {
                                var token3StartPos = text.indexOf(token3, startPos);
                                var token3EndPos = token3StartPos + token3.length;
                                if (token3StartPos >= startPos && token3StartPos <= endPos) {
                                    // overlapped, token2 contains part of token3
                                    endPos = token3StartPos + token3.length;
                                } else if (startPos >= token3StartPos && startPos <= token3EndPos) {
                                    // overlapped too, but token3 contains part of token2
                                    startPos = token3StartPos;
                                }
                            }
                        });

                        tokensThatContainItMergedPositions.push([startPos, endPos]);
                        tokensThatContainItMerged.push(text.substr(startPos, endPos - startPos));
                    }
                }
            });

            if (tokensThatContainItMerged.length > 1) {
                // test all tokensThatContainIt to find the one that happen in more than 
                // threshold percent of tokensThatContainItMerged
                // only do this if we found more than 1 tokensThatContainItMerged
                requiredCount = tokensThatContainItMerged.length * thresholdPercentage / 100;

                _.each(tokensThatContainIt, function(token2) {
                    if (!_.include(tokensThatContainItManyTime, token2)) {
                        var count = 0;
                        _.each(tokensThatContainItMerged, function(token3) {
                            if (token3.indexOf(token2) != -1) {
                                count++;
                            }
                        });

                        if (count > 1 && count >= requiredCount) {
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