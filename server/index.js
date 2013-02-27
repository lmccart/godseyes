/*
 * index.js
 *
 * godseyes
 *
 */


var common = require('./common.js');


function start() {

	common.mongo.open(function(err, p_client) {
	
		common.initialized = true;
		
		console.log("mongo open");

		
	});

};


// do the damn thing
start();

