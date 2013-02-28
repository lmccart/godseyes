/*
 * index.js
 *
 * godseyes
 *
 */

var http = require('http');
var common = require('./common.js');
var router = require('./router.js');


function start(route) {

	// open mongo connect
  common.mongo.open(function(err, p_client) {
		console.log("mongo open");
	});
	
	// create opentok sessions
	var location = common.config.ip; // use an IP or 'localhost'
	common.opentok.createSession(location, function(result){
	  common.otSessionId = result;
	  // Do things with sessionId
	});
	
	// routing fxn
	function onRequest(req, res) {
    var pathname = common.url.parse(req.url).pathname;
    console.log("Request for " + pathname + " received.");
    
    route(pathname);
    
	  res.writeHead(200, {'Content-Type': 'text/html'});
	  res.write('<h1>hello, i know nodejitsu.'+pathname+'</h1>');
	  res.end();
	}
	
	// creates a new httpServer instance
	http.createServer(onRequest).listen(8080); // the server will listen on port 8080
	
};


// do that thang
start(router.route);

