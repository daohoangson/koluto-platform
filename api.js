var api = exports;
var config = require('./config.js').config;
var db = require('./db.js');
var XML = require('./xml.js');
var apiData = {
    'version': 1,
    'responseFormat': 'json', // possible values: json, jsonp, xml
    'jsonpCallback': false, // only used with jsonp response format
    
    'appId': 0 // invalid!!!
};

api.appId = function() { return apiData.appId; };

api.authenticate = function(req, callback) {
    // validate the response format
    /*
    if (req.param('_responseFormat')) {
        apiData.responseFormat = req.param('_responseFormat');
    } else if (req.accepts('xml')) {
        apiData.responseFormat = 'xml';
    } else if (req.accepts('json')) {
        apiData.responseFormat = 'json';
    }
    */
    
    if (apiData.responseFormat == 'json' && req.param('callback')) {
        apiData.responseFormat = 'jsonp';
        apiData.jsonpCallback = req.param('callback');
    }

    // authorization...
    if (req.headers['authorization']) {
        var parts = req.headers['authorization'].split(' ');
        if (parts.length == 2) {
            if (parts[0] == 'Basic') {
                // basic authentication...
                var decoded = (new Buffer(parts[1], 'base64').toString('ascii'));
                parts = decoded.split(':');
                if (parts.length == 2) {
                    // we now have username and password
                    // trigger a database query, notice the extra else branch with callback()?
                    db.getUserByUserName(parts[0], function(err, user) {
                        if (!err && user) {
                            if (user.password == api.hashPassword(parts[1])) {
                                apiData.appId = user.app_id;
                            }
                        }
                        
                        callback();
                    });
                    
                    // prevent calling callback() at the end of this method
                    // it will be called in the anonymous method above...
                    return;
                }
            }
        }
    }
    
    callback();
};

api.response = function(res, data) {
    switch (apiData.responseFormat) {
    case 'xml':
        res.header('Content-Type', 'text/xml');
        res.write(XML.stringify(data));
        res.end();
        break;
    case 'json':
        // simplest format, just output it
        res.json(data);
        break;
    case 'jsonp':
        res.header('Content-Type', 'application/javascript');
        res.write(apiData.jsonpCallback + '(');
        res.write(JSON.stringify(data));
        res.write(');');
        res.end();
        break;
    }
};

api.responseError = function(res, errMessage, httpStatusCode) {
    if (httpStatusCode) {
        res.statusCode = httpStatusCode;
    }
    
    api.response(res, { 'error': errMessage });
}

api.responseNoPermission = function(res) {
    api.responseError(res, 'You don\'t have permission to access this resource', 403);
}

api.hashPassword = function(raw) {
    return require('crypto').createHash('md5').update(raw).digest('hex');
}

api.now = function() {
    return Math.round(Date.now() / 1000);
}

api.time = function() {
    // ugly I now, sorry
    return Date.now();
}

api.timeDiff = function(timestamp) {
    return api.time() - timestamp;
}