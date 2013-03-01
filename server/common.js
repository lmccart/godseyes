/*
 * common.js
 *
 * Copyright 2012 (c) Sosolimited http://sosolimited.com
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 *
 */


// Require the configuration file
var config = require(__dirname + "/config.json");
var fs = require('fs');

// Config opentok
var OpenTok = require('opentok');
var opentok = new OpenTok.OpenTokSDK(config.opentok.key, config.opentok.secret);

// Config mongo
var Db = require('mongodb').Db;
var MongoServer = require('mongodb').Server;
var mongo = new Db(config.mongo.db, new MongoServer(config.mongo.host, config.mongo.port, {strict:true, auto_reconnect:true}), {w: 1});
	
var newSession = function(p2p) {
	
	// create opentok session
	var location = config.ip; // use an IP or 'localhost'
	opentok.createSession(location, {'p2p.preference':p2p}, function(result){
	module.exports.otSessionID = result;
	console.log(module.exports.otSessionID+" session opened");
	});
};
	
// Exports
module.exports = {
	url : require('url'),
	net : require('net'),
	qs: require('querystring'),
	fs : fs,
	config : config,
	mongo : mongo,
	opentok : opentok,
	OpenTok : OpenTok,
	newSession : newSession,
	otSessionID : 'none'
 	
};

