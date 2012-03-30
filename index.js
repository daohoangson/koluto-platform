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
       ]
   }); 
});

app.get('/users', middlewareApiNoAuth, function(req, res) {
   api.responseError(res, 'POST with `username`, `password` and `email` to create an account');
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
    
    db.insertDocument(newDocument, function(err, document) {
        if (err) {
            api.responseError(res, 'Unable to insert document');
        } else {
            var documentModel = require('./model/document.js');
            
            var tokens = documentModel.parseText(document.text, {
                maxTokensToMerge: 3,
                keepMergedOnly: true
            });
            
            _.each(tokens, function(token) {
                db.incrAppWord(api.appId(), token, document.sections);
            });
            
            document.text = 'truncated';
            api.response(res, { 'document': document });
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
})

app.get('/words', middlewareApiAuth, function(req, res) {
    db.getAppWords(api.appId(), function(err, results) {
        api.response(res, { 'words': results });
    });
});

app.listen(29690);