var similarModel = exports;
var _ = require('underscore')._;
var util = require('util');
var db = require('../db.js');

similarModel.findSimilarDocuments_getFingerprint = function(text) {
    var textPreprocessed = text.replace(/\s+/g, '');
    textPreprocessed = textPreprocessed.replace(/[~`!@#$%\^&\*\(\)_=\+\[{\]}\\\|;:'",<.>\/\? …“” •–≤’®©]/g, ''); // pattern copied from tokenizer.js
    textPreprocessed = textPreprocessed.toLowerCase();
    
    var i = 0;
    var l = textPreprocessed.length;
    var n = 5; // n as in n-gram
    var w = 50; // window
    var fingerprint = [];
    var window = [];

    while (i < l) {
        window.push(textPreprocessed.substr(i, n)); // get n-gram
        i += 1;
        
        if (window.length >= w || i >= l) {
            // get the maximum token in window
            var max = false;
            var maxVal = 0;
            for (var wi = 0, wl = window.length; wi < wl; wi++) {
                var token = window[wi];
                var tokenVal = 0;
                for (var ti = 0, tl = token.length; ti < tl; ti++) {
                    tokenVal += token.charCodeAt(ti);
                }
                if (tokenVal > maxVal)
                {
                    max = token;
                    maxVal = tokenVal;
                }
            }
            
            if (max !== false) {
                fingerprint.push(max);
            }
            
            // this is the proper way to empty an array
            // read http://stackoverflow.com/questions/1232040/how-to-empty-an-array-in-javascript
            window.length = 0;
        }
    }

    return fingerprint;
};

similarModel.findSimilarDocuments_compareFingerprints = function(fp1, fp2) {
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

similarModel.findSimilarDocuments = function(appId, text, callback) {
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
        
        if (typeof g_latestText != 'undefined') {
            // some old job has been run here...
            if (g_latestText != g_text) {
                // the old job's text is not this text
                // we will reset its fingerprint
                g_fpText = false;
            }
        }
        g_latestText = g_text; // store the latest processed text to check later
        if (typeof g_fpText == 'undefined' || g_fpText === false) {
            // calculate the text fingerprint once for each 
            // computation unit only
            g_fpText = getFingerprint(g_text);
        }
 
        var result = compareFingerprints(fpThis, g_fpText);
        
        if (result > g_resultThreshold) {
            // only emit if the result is good enough
            emit(this._id, {'result': result});
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
            'g_text': text,
            'g_getFingerprint': similarModel.findSimilarDocuments_getFingerprint.toString(),
            'g_compareFingerprints': similarModel.findSimilarDocuments_compareFingerprints.toString(),
            'g_resultThreshold': 0.5
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

        callback(err, found);
    });
};