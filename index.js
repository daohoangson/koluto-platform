var _ = require('underscore')._;
var express = require('express');
var app = express.createServer();
var config = require('./config.js').config;
var api = require('./api.js');
var db = require('./db.js');

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
        if (api.appId() == 0) {
            res.statusCode = 401;
            res.header('WWW-Authenticate', 'Basic realm="' + config.G_NAME + '"');
            api.responseError(res, 'Authentication required');
        } else {
            next();
        }
    });
};

var middlewareApiNoAuth = function(req, res, next) {
    api.authenticate(req, next);
}

app.get('/', middlewareApiNoAuth, function(req, res, next) {
   api.response(res, {
       'links': [
            '/users',
            '/documents',
            '/words',
            '/sections',
       ]
   }); 
});

app.get('/users', middlewareApiNoAuth, function(req, res) {
   api.responseError(res, 'POST with `username`, `password` and `email` to create an account', 404);
});

app.post('/users', middlewareApiNoAuth, function(req, res) {
    var userName = req.body.username;
    var password = req.body.password;
    var email = req.body.email;
    
    if (!userName || !password) {
        api.responseError(res, '`Username` and `password` are all required, `email` is optional though...')
    } else {
        db.getUserByUserName(userName, function(err, user) {
            if (user) {
                api.responseError(res, 'Existing user found with specified username, forgot your password? (Tough luck for now, sorry)');
            } else {
                var newUser = {
                    'username': userName,
                    'password': api.hashPassword(password),
                    'email': email
                };

                db.insertUser(newUser, function(err, appId) {
                    if (err || !appId) {
                        api.responseError(res, 'Unable to register new user');
                    } else {
                        api.response(res, { 'app_id': appId });
                    }
                });
            }
        });
    }
})

app.get('/documents', middlewareApiAuth, function(req, res) {
    db.getDocuments(api.appId(), function(err, documents) {
        if (err) {
            api.responseError(res, 'Unable to get documents');
        } else {
            if (config.APP_DEBUG) {
                for (var i in documents) {
                    documents[i].curl = {
                        delete: 'curl http://sondh:1@127.0.0.1:' + config.APP_PORT + '/documents/' + documents[i]._id + ' -X DELETE'
                    };
                }
            };

            api.response(res, { 'documents': documents });
        }
    });
});

app.post('/documents', middlewareApiAuth, function(req, res) {
    var newDocument = {
        'appId': api.appId(),
        'text': req.body.text,
        'extraData': req.body.extraData,
        'sections': req.body.sections
    };

    var documentModel = require('./model/document.js');
    // var startTime = api.time();
    // console.log('Document length:', newDocument.text.length);
            
    newDocument.words = documentModel.parseText(newDocument.text, {
        maxTokensToMerge: 3,
        // keepMergedOnly: true, -- we should keep them, irrelevant tokens are removed by smart filters
        tryToBeSmart: 1
    });

    db.insertDocument(newDocument, function(err, document) {
        if (err) {
            api.responseError(res, 'Unable to insert document');
        } else {
            var counts = documentModel.countTokens(newDocument.words);
            
            for (var token in counts) {
                db.incrWord(api.appId(), token, newDocument.sections, counts[token]);
            }
            
            // var elapsed = api.timeDiff(startTime);
            // console.log('Elapsed time:', elapsed);
            
            api.response(res, { '_id': document._id });
        }
    })
});

app.del('/documents/:documentId', middlewareApiAuth, function(req, res) {
    db.getDocument(api.appId(), req.params.documentId, function(err, document) {
        if (err || !document) {
            api.responseError(res, 'The requested document could not be found', 404);
        } else if (document.appId != api.appId()) {
            api.responseNoPermission(res);
        } else {
            db.deleteDocument(document, function(err) {
                if (err) {
                    api.responseError(res, 'The requested document could not be deleted');
                } else {
                    api.response(res, { 'document': document, 'deleted': 1 });
                }
            });
        }
    });
});

app.get('/similar', middlewareApiAuth, function(req, res) {
    api.responseError(res, 'POST with `text` to find similar documents', 404);
});

app.post('/similar', middlewareApiAuth, function(req, res) {
    var text = req.body.text;
    
    // var startTime = api.time();
    // console.log('Text length:', text.length);

    if (text && text.length > 0) {
        db.findSimilarDocuments(api.appId(), text, function(err, documents) {
            
            // var elapsed = api.timeDiff(startTime);
            // console.log('Elapsed time:', elapsed);
            
            api.response(res, documents);
        });
    } else {
        api.responseError(res, '`text` is required for similar search', 500);
    }
});

app.get('/words', middlewareApiAuth, function(req, res) {
    var options = req.query['options'];

    db.getAppWords(api.appId(), options, function(err, results) {
        api.response(res, { 'words': results });
    });
});

app.get('/words/:word', middlewareApiAuth, function(req, res) {
    db.getAppWord(api.appId(), req.params.word, function(err, word) {
        api.response(res, { 'word': word });
    });
});

app.get('/sections/:section', middlewareApiAuth, function(req, res) {
    var filterAppWords = req.query['filterAppWords'];
    var options = req.query['options'];

    db.getAppSectionWords(api.appId(), req.params.section, options, function(err, sectionWords) {
        if (!!filterAppWords) {
            // get app words then filter them out from the section words
            db.getAppWords(api.appId(), options, function(err, appWords) {
                var wordsFiltered = sectionWords;
                if (!err) {
                    wordsFiltered = _.difference(wordsFiltered, appWords);
                }
                api.response(res, { 'section': { 'wordsFiltered' : wordsFiltered } });
            });
        } else {
            // return the list of words immediately
            api.response(res, { 'section': { 'words' : sectionWords } });
        }
    });
});

app.listen(config.APP_PORT);