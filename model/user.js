var userModel = exports;
var _ = require('underscore')._;
var util = require('util');
var db = require('../db.js');

userModel.getUserByUserName = function(userName, callback) {
    db.mysqlClient.query(
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

userModel.insertUser = function(newUser, callback) {
    db.mysqlClient.query(
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