var common = require('./common.js');

function route(url, res) {

  var pathname = common.url.parse(url).pathname;
  console.log("About to route a request for " + pathname);
  
  if (pathname === "/authenticate_user") {
  	var deviceid = common.qs.parse(url)["deviceid"];
  	var p2p = common.qs.parse(url)["p2p"];
  	var force = common.qs.parse(url)["force"];
  	
  	//console.log("deviceid:"+deviceid+" p2p:"+p2p+" force:"+force);	
  	authenticateUser(deviceid, p2p, force, res);
  	
  } else if (pathname === "/user_session_started") {
  	var deviceid = common.qs.parse(url)["deviceid"];
  	var desc = common.qs.parse(url)["desc"];
	  setUserStreaming(deviceid, true, desc, res);
  } else if (pathname === "/user_session_ended") {
  	var deviceid = common.qs.parse(url)["deviceid"];
  	var points = common.qs.parse(url)["points"];
	  setUserStreaming(deviceid, false, "", res);
	  setUserPoints(deviceid, points, res);
  }
  
  else if (pathname === "/get_current_sessions") {
  	var streaming = common.qs.parse(url)["streaming"];
	  getCurrentSessions(streaming, res);
  }
  else if (pathname === "/enter_session") {
	  var sessionid = common.qs.parse(url)["sessionid"];
	  enterSession(sessionid, res);
  }
  
  // DB management methods
  else if (pathname === "/ping") {
  	var deviceid = common.qs.parse(url)["deviceid"];
  	var points = common.qs.parse(url)["points"];
	  setUserPoints(deviceid, points, res);
  }
  else if (pathname === "/clear_db") {
  	clearDB(res);
  }
  else if (pathname === "/refresh_db") {
  	refreshDB(res);
  }
  
  // god logics
  else if (pathname === "/set_god") {
  	var deviceid = common.qs.parse(url)["deviceid"];
  	setGod(deviceid, res);
  }
  // god logics
  else if (pathname === "/remove_god") {
  	removeGod();
  }
}

//common.otSessionId

function authenticateUser(deviceid, p2p, force, res) {
	
	// if force flag, reset session automatically
	
	var p2pString = p2p ? 'enabled' : 'disabled';

	var tok = "";
	
	// note: forcing streaming to false
	if (force) { // force create new session
		newSession(p2pString, function(sessionid) { 
			var tok = newToken(sessionid); 
			updateUser(deviceid, sessionid, tok, false, 0, res);
		});
	} else {

		// check if in db already
		common.mongo.collection('users', function(e, c) {	
			c.findOne({'deviceid':deviceid}, function(err, doc) {
				if (doc) { 
						var tok = newToken(doc.sessionid);
						updateUser(deviceid, doc.sessionid, tok, false, doc.points, res);
				} else {  // create new id
					newSession(p2pString, function(sessionid) {
						var tok = newToken(sessionid);
						updateUser(deviceid, sessionid, tok, false, 0, res);
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


var newToken = function(sessionid) {
	var token = common.opentok.generateToken({session_id:sessionid, 
		role:common.OpenTok.RoleConstants.PUBLISHER, 
		connection_data:"userId:42temp"}); //metadata to pass to other users connected to the session. (eg. names, user id, etc)
	return token;			
}


function updateUser(deviceid, sessionid, tok, stream, points, res) {
	common.mongo.collection('users', function(e, c) {
		// upsert user with tok + id
		c.update({deviceid: deviceid},
			{$set: {sessionid: sessionid, token: tok, streaming: stream, points: points, updated:  new Date().getTime() }}, 
			{upsert:true},
			function(err) {
        if (err) console.warn("MONGO ERROR "+err.message);
        else console.log('successfully updated');
        
        // return json with tok + sessionid
        res.writeHead(200, { 'Content-Type': 'application/json' });   
        res.write(JSON.stringify({ deviceid:deviceid, token:tok, sessionid:sessionid, streaming: stream, points: points}));
        res.end();
    });
	});
}

function setUserStreaming(deviceid, streaming, desc, res) {
	common.mongo.collection('users', function(e, c) {
		// upsert user with tok + id
		c.update({deviceid: deviceid},
			{$set: {streaming: streaming, desc: desc}}, 
			function(err) {
        if (err) console.warn("MONGO ERROR "+err.message);
        else console.log('successfully updated user streaming '+streaming);
        
        
        // return json with tok + sessionid
        res.writeHead(200, { 'Content-Type': 'application/json' });   
        res.write(JSON.stringify({ deviceid:deviceid, streaming: streaming, desc:desc}));
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

function enterSession(deviceid, sessionid, res) {
	var tok = newToken(sessionid);

  // return json with tok + sessionid
  res.writeHead(200, { 'Content-Type': 'application/json' });   
  res.write(JSON.stringify({ token:tok }));
  res.end();

}


function setUserPoints(deviceid, points, res) {
	common.mongo.collection('users', function(e, c) {
		c.update({deviceid: deviceid},
			{$set: {points: parseInt(points, 10), updated: new Date().getTime() }}, 
			function(err) {
        if (err) console.warn("MONGO ERROR "+err.message);
        else console.log('successfully updated user points '+points);

        // return json with tok + sessionid
        res.writeHead(200, { 'Content-Type': 'application/json' });   
        res.write(JSON.stringify({ deviceid:deviceid, points: parseInt(points, 10)}));
        res.end();
    });
	});	
}

function setGod(deviceid, res) {
	removeGod();
	common.mongo.collection('users', function(e, c) {
		c.update({deviceid: deviceid},
			{$set: {isGod: true, godStart: new Date().Time(), points: 0 }}, 
			function(err) {
        if (err) console.warn("MONGO ERROR "+err.message);
        console.log('god is now '+deviceid);
    });
	});	
}

function removeGod() {
	common.mongo.collection('users', function(e, c) {
		c.findAndModify({isGod: true}, {}, {$set: {isGod: false}}, {upsert: false},
			function(err, object) {
        if (err) console.warn("MONGO ERROR "+err.message);
        if (object) {	
        	console.log('removed god '+object.deviceid);
        	common.sendPush(deviceid, 'You are no longer god');
        } else console.log('no current god');
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



