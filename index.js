var _ = require('underscore')._;
var express = require('express');
var app = express.createServer();
var config = require('./config.js').config;
var api = require('./api.js');
var userModel = require('./model/user.js');
var documentModel = require('./model/document.js');
var wordModel = require('./model/word.js');

app.configure(function() {
    app.use(express.logger({ format: ':method :url :req[Accept]' }));

    app.use(express.bodyParser());
    
    //app.use(express.methodOverride());
    //app.use(express.cookieParser());
    //app.use(express.session({ secret: "foo bar" }));

    app.use(app.router);
});

app.configure('development', function() {
    app.use(express.static(__dirname + '/public'));
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function() {
    var oneYear = 31557600000;
    app.use(express.static(__dirname + '/public', { maxAge: oneYear }));
    app.use(express.errorHandler());
});

var middlewareApiAuth = function(req, res, next) {
    api.authenticate(req, function(errCode, errMessage) {
        if (api.appId(req) == 0) {
            res.statusCode = 401;
            res.header('WWW-Authenticate', 'Basic realm="' + config.G_NAME + '"');
            api.responseError(req, res, 'Authentication required');
        } else {
            next();
        }
    });
};

var middlewareApiNoAuth = function(req, res, next) {
    api.authenticate(req, next);
}

app.get('/', middlewareApiNoAuth, function(req, res, next) {
   api.response(req, res, {
       'links': [
            '/users',
            '/documents',
            '/words',
            '/sections',
       ]
   }); 
});

app.get('/users', middlewareApiNoAuth, function(req, res) {
   api.responseError(req, res, 'POST with `username`, `password` and `email` to create an account', 404);
});

app.post('/users', middlewareApiNoAuth, function(req, res) {
    var userName = req.body.username;
    var password = req.body.password;
    var email = req.body.email;
    
    if (!userName || !password) {
        api.responseError(req, res, '`Username` and `password` are all required, `email` is optional though...')
    } else {
        userModel.getUserByUserName(userName, function(err, user) {
            if (user) {
                api.responseError(req, res, 'Existing user found with specified username, forgot your password? (Tough luck for now, sorry)');
            } else {
                var newUser = {
                    'username': userName,
                    'password': api.hashPassword(password),
                    'email': email
                };

                userModel.insertUser(newUser, function(err, appId) {
                    if (err || !appId) {
                        api.responseError(req, res, 'Unable to register new user');
                    } else {
                        api.response(req, res, { 'app_id': appId });
                    }
                });
            }
        });
    }
})

app.get('/documents', middlewareApiAuth, function(req, res) {
    documentModel.getDocuments(api.appId(req), function(err, documents) {
        if (err) {
            api.responseError(req, res, 'Unable to get documents');
        } else {
            if (config.APP_DEBUG) {
                for (var i in documents) {
                    documents[i].curl = {
                        delete: 'curl http://sondh:1@127.0.0.1:' + config.APP_PORT + '/documents/' + documents[i]._id + ' -X DELETE'
                    };
                }
            };

            api.response(req, res, { 'documents': documents });
        }
    });
});

app.post('/documents', middlewareApiAuth, function(req, res) {
    var newDocument = {
        'appId': api.appId(req),
        'text': req.body.text,
        'extraData': req.body.extraData,
        'sections': req.body.sections
    };

    // var startTime = api.time();
    // console.log('Document length:', newDocument.text.length);
            
    newDocument.words = documentModel.parseText(newDocument.text, {
        maxTokensToMerge: 3,
        /*
        // keepMergedOnly: true, -- we should keep them, irrelevant tokens are removed by smart filters
        tryToBeSmart: 1
        */
        keepMergedOnly: true, // play it dump, we need more speed!
    });

    documentModel.insertDocument(newDocument, function(err, document) {
        if (err) {
            api.responseError(req, res, 'Unable to insert document');
        } else {
            var counts = documentModel.countTokens(newDocument.words);
            
            for (var token in counts) {
                if (counts[token] < 2) {
                    // do not process single instance tokens
                    // we need more speed!
                    continue;
                }
                
                wordModel.incrWord(api.appId(req), token, newDocument.sections, counts[token]);
            }
            
            // var elapsed = api.timeDiff(startTime);
            // console.log('Elapsed time:', elapsed);
            
            api.response(req, res, { '_id': document._id });
        }
    })
});

app.del('/documents/:documentId', middlewareApiAuth, function(req, res) {
    documentModel.getDocument(api.appId(req), req.params.documentId, function(err, document) {
        if (err || !document) {
            api.responseError(req, res, 'The requested document could not be found', 404);
        } else if (document.appId != api.appId(req)) {
            api.responseNoPermission(req, res);
        } else {
            documentModel.deleteDocument(document, function(err) {
                if (err) {
                    api.responseError(req, res, 'The requested document could not be deleted');
                } else {
                    api.response(req, res, { 'document': document, 'deleted': 1 });
                }
            });
        }
    });
});

app.get('/similar', middlewareApiAuth, function(req, res) {
    api.responseError(req, res, 'POST with `text` to find similar documents', 404);
});

app.post('/similar', middlewareApiAuth, function(req, res) {
    var text = req.body.text;
    
    // var startTime = api.time();
    // console.log('Text length:', text.length);

    if (text && text.length > 0) {
        db.findSimilarDocuments(api.appId(req), text, function(err, documents) {
            
            // var elapsed = api.timeDiff(startTime);
            // console.log('Elapsed time:', elapsed);
            
            api.response(req, res, documents);
        });
    } else {
        api.responseError(req, res, '`text` is required for similar search', 500);
    }
});

app.get('/words', middlewareApiAuth, function(req, res) {
    var options = req.query['options'];

    wordModel.getAppWords(api.appId(req), options, function(err, results) {
        api.response(req, res, { 'words': results });
    });
});

app.get('/words/:word', middlewareApiAuth, function(req, res) {
    wordModel.getAppWord(api.appId(req), req.params.word, function(err, word) {
        api.response(req, res, { 'word': word });
    });
});

app.get('/sections/:section', middlewareApiAuth, function(req, res) {
    var filterAppWords = req.query['filterAppWords'];
    var options = req.query['options'];

    wordModel.getAppSectionWords(api.appId(req), req.params.section, options, function(err, sectionWords) {
        if (!!filterAppWords) {
            // get app words then filter them out from the section words
            wordModel.getAppWords(api.appId(req), options, function(err, appWords) {
                var wordsFiltered = sectionWords;
                if (!err) {
                    wordsFiltered = _.difference(wordsFiltered, appWords);
                }
                api.response(req, res, { 'section': { 'wordsFiltered' : wordsFiltered } });
            });
        } else {
            // return the list of words immediately
            api.response(req, res, { 'section': { 'words' : sectionWords } });
        }
    });
});

app.listen(config.APP_PORT);