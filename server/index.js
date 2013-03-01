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
	
	common.newSession('enabled');

	// routing fxn
	function onRequest(req, res) {
    
    route(req.url, res);
    /*
	  res.writeHead(200, {'Content-Type': 'text/html'});
	  res.write('<h1>hello, i know nodejitsu.</h1>');
	  res.end();*/
	}
	
	// creates a new httpServer instance
	http.createServer(onRequest).listen(8080); // the server will listen on port 8080
	
};


// do that thang
start(router.route);

