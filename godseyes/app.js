
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , user = require('./routes/user')
  , http = require('http')
  , path = require('path');

var app = express();
var common = require('./common.js');


// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);
app.get('/users', user.list);

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

app.get('/authenticate_user', function(req, res){
  authenticateUser(req.query.deviceid, req.query.version, req.query.p2p, req.query.force, res);
});

app.get('/get_current_sessions', function(req, res){
  getCurrentSessions(req.query.streaming, res);
});

app.get('/remove_user', function(req, res) {
	removeUser(req.query.deviceid, res);
});

app.get('/set_airship_token', function(req, res) {
	setAirshipToken(req.query.deviceid, req.query.airshiptoken, res);
});
  
app.get('/user_session_started', function(req, res) {
  setUserStreaming(req.query.deviceid, true, res);
});

app.get('/user_session_ended', function(req, res) {
  setUserStreaming(req.query.deviceid, false, res);
  setUserPoints(req.query.deviceid, req.query.points, res);
});

app.get('/enter_random_session', function(req, res) {
	enterRandomSession(req.query.streaming, res);
});

app.get('/enter_session', function(req, res) {
	enterSession(req.query.sessionid, res);
});
  
// DB management methods
app.get('/god_ping', function(req, res) {
	getCurrentSessions('true', res, godPing, req.query.deviceid);
});

app.get('/ping', function(req, res) {
	  setUserPoints(req.query.deviceid, req.query.points, res);
	  if (req.query.img)
		  setUserImg(req.query.deviceid, req.query.img);
});

app.get('/clear_db', function(req, res) {
	clearDB(res);
});

app.get('/refresh_db', function(req, res) {
	refreshDB(res);
});

// god logics

app.get('/set_god', function(req, res) {
  	setGod(req.query.deviceid, res);
});

app.get('/summon_eyes', function(req, res) {
	if (new Date().getTime() - common.lastEyesSummon > common.summonFrequency) {
		common.broadcastPush("my eyes I summon you", [["type",1]], res);
		common.lastEyesSummon = new Date().getTime();
	}
});

app.get('/god_status', function(req, res) {
	godStatus(res);
});

app.get('/message_god', function(req, res) {
	  messageGod(req.query.deviceid, req.query.msg, res);
});

app.get('/test_send', function(req, res) {
	common.sendPush(req.query.airshiptoken, "test send", [["type",4], ["additional","args"]], res);
});

/// SET METHODS FOR VARS
app.get('/set_summon_frequency', function(req, res) {
	if (req.query.summonFrequency) {
		common.summonFrequency = parseInt(req.query.summonFrequency, 10);
		res.json({ success: true, summonFrequency: common.summonFrequency });
	} else res.json({ success: false });
});

app.get('/set_cur_version', function(req, res) {
	if (req.query.curVersion) {
		common.curVersion = parseFloat(req.query.curVersion);
		res.json({ success: true, curVersion: common.curVersion });
	} else res.json({ success: false });
});

app.get('/set_point_speeds', function(req, res) {
	if (req.query.speed0 && req.query.speed1) {
		common.pointSpeeds = [parseInt(req.query.speed0, 10), parseInt(req.query.speed1, 10)];
		res.json({ success: true, pointSpeeds: common.pointSpeeds });
	} else res.json({ success: false });
});



function authenticateUser(deviceid, version, p2p, force, res) {
	
	var p2pString = p2p ? 'enabled' : 'disabled';
	var tok = "";
	
	var versionExpired = (version < common.curVersion);
				
	// if force flag, reset session automatically
	// note: forcing streaming to false
	if (force) { // force create new session
		newSession(p2pString, function(sessionid) { 
			var tok = newToken(sessionid, false); 
			updateUser(deviceid, versionExpired, sessionid, tok, false, 0, false, res);
		});
	} else {

		// check if in db already
		common.mongo.collection('users', function(e, c) {	
			c.findOne({'deviceid':deviceid}, function(err, doc) {
				if (doc) { 
						var tok = newToken(doc.sessionid, false);
						var points = doc.points ? doc.points : 0;
						updateUser(deviceid, versionExpired, doc.sessionid, tok, false, points, doc.isGod, res);
				} else {  // create new id
					newSession(p2pString, function(sessionid) {
						var tok = newToken(sessionid, false);
						updateUser(deviceid, versionExpired, sessionid, tok, false, 0, false, res);
					});
				}
			});
		});
	}							
}

function removeUser(deviceid, res) {
	common.mongo.collection('users', function(e, c) {	
		
		c.findAndModify({deviceid: deviceid}, {}, {}, {remove: true}, function(err, doc) {
			if (err) console.log(err);
			console.log("removed "+deviceid);
		});
    res.json({ success:true, removed: deviceid});
	});	
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
	var expire = isGod ? new Date().getTime() + (1000*60*60*24) : new Date().getTime() + (7*1000*60*60*24); // one day or one week

	var token = common.opentok.generateToken({session_id:sessionid, 
		role:common.OpenTok.RoleConstants.PUBLISHER, 
		expire_time: expire, 
		connection_data:"userId:42temp"}); //metadata to pass to other users connected to the session. (eg. names, user id, etc)
	return token;			
}


function updateUser(deviceid, expired, sessionid, tok, stream, points, isGod, res) {
	common.mongo.collection('users', function(e, c) {
		// upsert user with tok + id
		c.update({deviceid: deviceid},
			{$set: {sessionid: sessionid, token: tok, streaming: stream, points: points, isGod: isGod, updated: new Date().getTime(), expired:expired }}, 
			{upsert:true},
			function(err) {
        if (err) console.warn("MONGO ERROR "+err.message);
        else console.log('successfully updated');
        
        // return json with tok + sessionid
        res.json({ deviceid:deviceid, expired:expired, token:tok, sessionid:sessionid, streaming: stream, points: points, isGod: isGod, pointSpeeds: common.pointSpeeds});
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
		        
	        res.json({ deviceid:deviceid, airshiptoken:airshiptoken.toUpperCase()});
	    });
		});	
	});
}

function setUserStreaming(deviceid, streaming, res) {
	common.mongo.collection('users', function(e, c) {
		// upsert user with tok + id
		c.update({deviceid: deviceid},
			{$set: {streaming: streaming, started: new Date().getTime() }}, 
			function(err) {
        if (err) console.warn("MONGO ERROR "+err.message);
        else console.log('successfully updated user streaming '+streaming);
        
        res.json({ deviceid:deviceid, streaming: streaming });
    });
	});	
}

// takes a callback, if none specified calls printResults
function getCurrentSessions(streaming, res, func, args) {
	
	var stream_args = {};
	if (streaming == 'true') stream_args = { streaming:true };
	else if (streaming == 'false') stream_args = { streaming:false };

	common.mongo.collection('users', function(e, c) {
		c.find(stream_args).toArray(function(err, results) {
			console.log(results+" "+err);
			if (func) func(results, res, args);
			else {
				//console.log(JSON.stringify(results)+" "+err);
				res.json(results);
			}
		});
  });
}


function enterRandomSession(streaming, res) {
	var args = {};
	if (streaming == 'true') args = {streaming:true};
	else if (streaming == 'false') args = {streaming:false};

	common.mongo.collection('users', function(e, c) {
	
		c.find(args).count(function(err, num) {
			if (num > 0) {
				var n = Math.floor(Math.random()*num);
				c.find(args).limit(-1).skip(n).toArray(function(err, results) {
					console.log(results[0].sessionid);
		      enterSession(results[0].sessionid, res);
				});
			} else {
        res.json({status:"no sessions available"});
			}
		});
		
  });
}


function enterSession(sessionid, res) {
	var tok = newToken(sessionid, true);

  // return json with tok + sessionid  
  res.json({ token:tok, sessionid:sessionid });

}


function setUserPoints(deviceid, points, res) {
	common.mongo.collection('users', function(e, c) {
		c.update({deviceid: deviceid},
			{$set: {points: parseInt(points, 10), streaming: true, updated: new Date().getTime() }}, 
			function(err) {
        if (err) console.warn("MONGO ERROR "+err.message);
        else console.log('successfully updated user points '+points);

        godStatus(res);
    });
	});	
}

function setUserImg(deviceid, img) {
	common.mongo.collection('users', function(e, c) {
		c.update({deviceid: deviceid},
			{$set: {img: img }}, 
			function(err) {
        if (err) console.warn("MONGO ERROR "+err.message);
        else console.log('successfully updated user img '+img);
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
        	common.sendPush(object.airshiptoken, 'You are no longer god', [["type", 0]]);
        } else console.log('no current god');
        
        var godExpire = new Date(new Date().getTime() + 5*60*1000);
        c.update({deviceid: deviceid},
					{$set: {isGod: true, godExpire: godExpire, points: 0 }}, // 5 min expire for now
					function(err) {
		        if (err) console.warn("MONGO ERROR "+err.message);
		        console.log('god is now '+deviceid);
		        common.lastEyesSummon = 0; // reset last summons time
		        
		        res.json({ success:true, god:deviceid, godExpire: godExpire});
		    });		        
		  });
	});	
}

function godPing(sessions, res, deviceid) {
	console.log("deviceid ="+deviceid);
	common.mongo.collection('users', function(e, c) {	
		c.findOne({deviceid:deviceid}, function(err, doc) {
			var isGod = false;
			if (doc) { 
				isGod = doc.isGod;
				console.log("doc = "+doc);
			} else console.log('no doc found');
					 
	    res.json({ isGod:isGod, sessions:sessions });
		});
	});
}

function godStatus(res) {
		// check if in db already
	common.mongo.collection('users', function(e, c) {	
		c.findOne({isGod:true}, function(err, doc) {
			var timeGodhoodAvailable = new Date().toISOString();
			var godhoodAvailable = true;
			if (doc) { 
				godhoodAvailable = new Date() > doc.godExpire;
				timeGodhoodAvailable = doc.godExpire.toISOString();
			} else {  
				console.log("no god found");
			}
		
      res.json({ godhoodAvailable: godhoodAvailable, timeGodhoodAvailable: timeGodhoodAvailable, godSummonable: false, pointSpeeds: common.pointSpeeds });
		});
	});
}

function messageGod(deviceid, msg, res) {
	common.mongo.collection('users', function(e, c) {	
		c.findOne({isGod:true}, function(err, doc) {
			if (doc) { 
			 
  			c.findOne({deviceid:deviceid}, function(err, ddoc) {
    			var sessionid = "";
    			var desc = "";
    			if (ddoc) {
      			sessionid = ddoc.sessionid;
      			desc = ddoc.desc.substring(0, Math.min(ddoc.desc.length,75));
    			}
  				common.sendPush(doc.airshiptoken, msg, [["type",3], ["sessionid",sessionid], ["desc", desc]], res);
          res.json({ status: "message sent" });
        });
			} else {  
				console.log("no god found"); 
        res.json({ status: "no god found."});
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
		var t = new Date().getTime() - (15*1000);
		
		c.findAndModify({updated: { $lt: t}, streaming: true}, {}, {$set: {streaming: false}}, {upsert: false}, function(err, doc) {
			if (doc) console.log("removed "+doc.deviceid);
		});
	});
}

exports.refreshDB = refreshDB;



