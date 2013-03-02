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
  	
  } 
  else if (pathname === "/set_airship_token") {
  	var deviceid = common.qs.parse(url)["deviceid"];
  	var airshiptoken = common.qs.parse(url)["airshiptoken"];
  	setAirshipToken(deviceid, airshiptoken, res);
  }
  
  else if (pathname === "/user_session_started") {
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
  else if (pathname === "/summon_eyes") {
	  common.broadcastPush("my eyes I summon you", res);
  }
  else if (pathname === "/how_long_god"){
  	howLongGod(res);
  }
  
  // testing methods
  else if (pathname === "/test_send") {
  	var airshiptoken = common.qs.parse(url)["airshiptoken"];
	  common.sendPush(airshiptoken, "test send", res);
  }
}

//common.otSessionId

function authenticateUser(deviceid, p2p, force, res) {
	
	var p2pString = p2p ? 'enabled' : 'disabled';
	var tok = "";
	
	// if force flag, reset session automatically
	// note: forcing streaming to false
	if (force) { // force create new session
		newSession(p2pString, function(sessionid) { 
			var tok = newToken(sessionid, false); 
			updateUser(deviceid, sessionid, tok, false, 0, res);
		});
	} else {

		// check if in db already
		common.mongo.collection('users', function(e, c) {	
			c.findOne({'deviceid':deviceid}, function(err, doc) {
				if (doc) { 
						var tok = newToken(doc.sessionid, false);
						updateUser(deviceid, doc.sessionid, tok, false, doc.points, res);
				} else {  // create new id
					newSession(p2pString, function(sessionid) {
						var tok = newToken(sessionid, false);
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


function newToken(sessionid, isGod) {
	var expire = isGod ? new Date().Time() + (1000*60*60*24) : new Date().Time() + (7*1000*60*60*24); // one day or one week

	var token = common.opentok.generateToken({session_id:sessionid, 
		role:common.OpenTok.RoleConstants.PUBLISHER, 
		expire_time: expire, 
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

function setAirshipToken(deviceid, airshiptoken, res) {

	// register with ua
	common.ua.registerDevice(airshiptoken.toUpperCase(), function(error) {
		if (error) console.log("airship error! "+error);
		common.mongo.collection('users', function(e, c) {
			// upsert user with tok + id
			c.update({deviceid: deviceid},
				{$set: {airshiptoken: airshiptoken.toUpperCase()}}, 
				function(err) {
	        if (err) console.warn("MONGO ERROR "+err.message);
	        else console.log('successfully updated ua token '+airshiptoken.toUpperCase());
		        
	        // return json with tok + sessionid
	        res.writeHead(200, { 'Content-Type': 'application/json' });   
	        res.write(JSON.stringify({ deviceid:deviceid, airshiptoken:airshiptoken.toUpperCase()}));
	        res.end();
	    });
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

function enterSession(sessionid, res) {
	var tok = newToken(sessionid, true);

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

	common.mongo.collection('users', function(e, c) {
		c.findAndModify({isGod: true}, {}, {$set: {isGod: false}}, {upsert: false},
			function(err, object) {
        if (err) console.warn("MONGO ERROR "+err.message);
        if (object) {	
        	console.log('removed god '+object.deviceid);
        	common.sendPush(object.airshiptoken, 'You are no longer god');
        } else console.log('no current god');
        
        c.update({deviceid: deviceid},
					{$set: {isGod: true, godStart: new Date().getTime(), points: 0 }}, 
					function(err) {
		        if (err) console.warn("MONGO ERROR "+err.message);
		        console.log('god is now '+deviceid);
		        
		        // return json with tok + sessionid
		        res.writeHead(200, { 'Content-Type': 'application/json' });   
		        res.write(JSON.stringify({ success:true, god:deviceid}));
		        res.end();
		    });
		        
    });
	});	


}



function howLongGod(res) {
			// check if in db already
		common.mongo.collection('users', function(e, c) {	
			c.findOne({isGod:true}, function(err, doc) {
				if (doc) { 
					var timeElapsed = new Date().getTime() - doc.godStart;
					var timeRemaining = Math.max(60*60*1000 - timeElapsed, 0);
	        res.writeHead(200, { 'Content-Type': 'application/json' });   
	        res.write(JSON.stringify({ time: timeRemaining}));
	        res.end();
				} else {  
					console.log("no god found");
	        // no god, time=0
	        res.writeHead(200, { 'Content-Type': 'application/json' });   
	        res.write(JSON.stringify({ time: 0}));
	        res.end();
				}
        
				
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



