var common = require('./common.js');

function route(url) {

  var pathname = common.url.parse(url).pathname;
  console.log("About to route a request for " + pathname);
  
  if (pathname === "/authenticate_user") {
  	var did = common.qs.parse(url)["deviceid"];
  	var p2p = common.qs.parse(url)["p2p"];
  	var force = common.qs.parse(url)["force"];
  	
  	console.log("did:"+did+" p2p:"+p2p+" force:"+force);
  	
  	authenticateUser(did);
  } else if (pathname === "/user_session_started") {
	  handleUserSessionStarted();
  } else if (pathname === "/user_session_ended") {
	  handleUserSessionEnded();
  }
}

//common.otSessionId

function authenticateUser(did) {
console.log(common.otSessionID);
	var token = common.opentok.generateToken({session_id:common.otSessionID, 
																						role:common.OpenTok.RoleConstants.PUBLISHER, 
																						connection_data:"userId:42"});//metadata to pass to other users connected to the session. (eg. names, user id, etc)
																						
																						
	common.mongo.collection('users', function(e, c) {
		// upsert user with tok + id
		c.update({did: did},
			{$set: {token: token}}, 
			{upsert:true},
			function(err) {
        if (err) console.warn("MONGO ERROR "+err.message);
        else console.log('successfully updated');
		});
	});
}

function handleUserSessionStarted() {
	
}

function handleUserSessionEnded() {
	
}

exports.route = route;



