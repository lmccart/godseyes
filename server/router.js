var common = require('./common.js');

function route(url, res) {

  var pathname = common.url.parse(url).pathname;
  console.log("About to route a request for " + pathname);
  
  if (pathname === "/authenticate_user") {
  	var did = common.qs.parse(url)["deviceid"];
  	var p2p = common.qs.parse(url)["p2p"];
  	var force = common.qs.parse(url)["force"];
  	
  	//console.log("did:"+did+" p2p:"+p2p+" force:"+force);	
  	authenticateUser(did, p2p, force, res);
  	
  } else if (pathname === "/user_session_started") {
  	var did = common.qs.parse(url)["deviceid"];
  	var desc = common.qs.parse(url)["desc"];
	  setUserStreaming(did, true, desc, res);
  } else if (pathname === "/user_session_ended") {
  	var did = common.qs.parse(url)["deviceid"];
  	var points = common.qs.parse(url)["points"];
	  setUserStreaming(did, false, "", res);
	  setUserPoints(did, points, res);
  }
  
  else if (pathname === "/get_current_sessions") {
  	var streaming = common.qs.parse(url)["streaming"];
	  getCurrentSessions(streaming, res);
  }
  
  else if (pathname === "/ping") {
  	var did = common.qs.parse(url)["deviceid"];
  	var points = common.qs.parse(url)["points"];
	  setUserPoints(did, points, res);
  }
  
  else if (pathname === "/clear_db") {
  	clearDB(res);
  }
  
  else if (pathname === "/refresh_db") {
  	refreshDB(res);
  }
}

//common.otSessionId

function authenticateUser(did, p2p, force, res) {
	
	// if force flag, reset session automatically
	
	var p2pString = p2p ? 'enabled' : 'disabled';

	var tok = "";
	
	// note: forcing streaming to false
	if (force) { // force create new session
		newSession(p2pString, function(sessID) { 
			var tok = newToken(sessID); 
			updateUser(did, sessID, tok, false, 0, res);
		});
	} else {

		// check if in db already
		common.mongo.collection('users', function(e, c) {	
			c.findOne({'did':did}, function(err, doc) {
				if (doc) { 
						var tok = newToken(doc.sessionID);
						updateUser(did, doc.sessionID, tok, false, doc.points, res);
				} else {  // create new id
					newSession(p2pString, function(sessID) {
						var tok = newToken(sessID);
						updateUser(did, sessID, tok, false, 0, res);
					});
				}
			});
		});
	}							
}

function newSession(p2p, cb) {
	console.log("opening new session");
	// create opentok session
	var location = common.config.ip; // use an IP or 'localhost'
	common.opentok.createSession(location, {'p2p.preference':p2p}, function(result){
		console.log("session opened "+result);
		cb(result);
	});
}


var newToken = function(sessID) {
	var token = common.opentok.generateToken({session_id:sessID, 
		role:common.OpenTok.RoleConstants.PUBLISHER, 
		connection_data:"userId:42temp"}); //metadata to pass to other users connected to the session. (eg. names, user id, etc)
	return token;			
}


function updateUser(did, sessID, tok, stream, points, res) {
	common.mongo.collection('users', function(e, c) {
		// upsert user with tok + id
		c.update({did: did},
			{$set: {sessionID: sessID, token: tok, streaming: stream, points: points, updated:  new Date().getTime() }}, 
			{upsert:true},
			function(err) {
        if (err) console.warn("MONGO ERROR "+err.message);
        else console.log('successfully updated');
        
        // return json with tok + sessID
        res.writeHead(200, { 'Content-Type': 'application/json' });   
        res.write(JSON.stringify({ did:did, token:tok, sessionID:sessID, streaming: stream, points: points}));
        res.end();
    });
	});
}

function setUserStreaming(did, streaming, desc, res) {
	common.mongo.collection('users', function(e, c) {
		// upsert user with tok + id
		c.update({did: did},
			{$set: {streaming: streaming, desc: desc}}, 
			function(err) {
        if (err) console.warn("MONGO ERROR "+err.message);
        else console.log('successfully updated user streaming '+streaming);
        
        
        // return json with tok + sessID
        res.writeHead(200, { 'Content-Type': 'application/json' });   
        res.write(JSON.stringify({ did:did, streaming: streaming, desc:desc}));
        res.end();
    });
	});	
}

function getCurrentSessions(streaming, res) {
	var args = {};
	if (streaming == 'true') args = {streaming:true};
	else if (streaming == 'false') args = {streaming:false};

	common.mongo.collection('users', function(e, c) {
		c.find(args).toArray(function(err, results) {
			console.log(results+" "+err);
        res.writeHead(200, { 'Content-Type': 'application/json' });   
        res.write(JSON.stringify(results));
        res.end();
        

        
		});
  });
}


function setUserPoints(did, points, res) {
	common.mongo.collection('users', function(e, c) {
		c.update({did: did},
			{$set: {points: parseInt(points, 10), updated: new Date().getTime() }}, 
			function(err) {
        if (err) console.warn("MONGO ERROR "+err.message);
        else console.log('successfully updated user points '+points);

        // return json with tok + sessID
        res.writeHead(200, { 'Content-Type': 'application/json' });   
        res.write(JSON.stringify({ did:did, points: parseInt(points, 10)}));
        res.end();
    });
	});	
}


function clearDB(res) {
	
	common.mongo.collection('users', function(e, c) {
    c.drop(function(err, reply) {
	    getCurrentSessions('', res);
    });
  });
}

function refreshDB() {
	common.mongo.collection('users', function(e, c) {	
		var t = new Date().getTime() - (2*60*1000);
		c.findAndModify({updated: { $lt: t}}, {}, {}, { remove: true } , function(err, doc) {
			console.log("removed "+doc);
		});
	});
}

exports.route = route;
exports.refreshDB = refreshDB;



