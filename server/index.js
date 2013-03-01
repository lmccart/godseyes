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
	  if (err) { throw err; }
	  console.log('mongo open');
	  common.mongo.authenticate(common.config.mongo.user, common.config.mongo.pass, function (err, replies) {
	    // You are now connected and authenticated.
	    console.log('mongo authenticated');
	  });
	});
	

	// routing fxn
	function onRequest(req, res) {
	 
    route(req.url, res);
    
    //common.sendToSocket("HIHIHI");
    
	}
	
	// creates a new httpServer instance
	http.createServer(onRequest).listen(8080); // the server will listen on port 8080
	
};


// do that thang
start(router.route);

