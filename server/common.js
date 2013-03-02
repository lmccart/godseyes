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
//var config = require(__dirname + "/config_prod.json");
var config = require(__dirname + "/config.json");

// Config opentok
var OpenTok = require('opentok');
var opentok = new OpenTok.OpenTokSDK(config.opentok.key, config.opentok.secret);

// Config mongo
var Db = require('mongodb').Db;
var MongoServer = require('mongodb').Server;
var mongo = new Db(config.mongo.db, new MongoServer(config.mongo.host, config.mongo.port, {strict:true, auto_reconnect:true}), {w: 1});

// Date helpers
require('date-utils');

/*// Socket stuff
var io = require('socket.io').listen(80);
var socket;

io.sockets.on('connection', function (socket) {
  console.log("opened socket");
  socket = socket;
});

var sendToSocket = function(msg) {
	if (socket) {
		 socket.emit('msg', msg);
	}
};*/

// Push notifications
var UA = require('urban-airship');
ua = new UA(config.ua.appkey, config.ua.appsecret, config.ua.appmastersecret);

//app key: jEzYHFRERgKkyWE9R_nhyw
//app secret: A2jpyiKeS6aEbmRIoLzhKw

// send to user
var sendPush = function(airshiptoken, msg, res) {

	var payload0 = {
    "device_tokens": [ airshiptoken ],
    "aps": {
        "alert": msg,
        "badge": 2
    }
  };

  ua.pushNotification("/api/push", payload0, function(error) {
	  if (error) console.log("ua error sending payload "+error);
	  
	  else {
	    // return json with tok + sessionid
	    res.writeHead(200, { 'Content-Type': 'application/json' });   
	    res.write(JSON.stringify({ airshiptoken:airshiptoken, success:true }));
	    res.end();
	  }
  });

};

// send to all but god
var broadcastPush = function(msg, res) {
	mongo.collection('users', function(e, c) {	
		c.findOne({'isGod':true}, function(err, doc) {
			if (doc) { 
				var payload1 = {
			    "aps": {
			         "badge": 15,
			         "alert": msg,
			         "sound": "cat.caf"
			    },
			    "exclude_tokens": [ doc.airshiptoken ]
			  };
			
				ua.pushNotification("/api/push/broadcast/", payload1, function(error) {
					if (error) console.log('failed to broadcast '+error);
					
			    // return json with tok + sessionid
			    res.writeHead(200, { 'Content-Type': 'application/json' });   
			    res.write(JSON.stringify({ success: true }));
			    res.end();
								
				});
			} else {
				console.log('failed to find god');
				
		    // return json with tok + sessionid
		    res.writeHead(200, { 'Content-Type': 'application/json' });   
		    res.write(JSON.stringify({ success: false }));
		    res.end();
			}
		});
	});
};

// Exports
module.exports = {
	url : require('url'),
	net : require('net'),
	qs: require('querystring'),
	fs : require('fs'),
	config : config,
	mongo : mongo,
	opentok : opentok,
	OpenTok : OpenTok,
	sendPush : sendPush,
	broadcastPush : broadcastPush,
	ua : ua
 	
};

