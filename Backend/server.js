var app = require('express')();
var http = require('http');
var fs = require("fs");
var url = require("url");
var querystring = require("querystring");
var smoke = require('smokesignal')
var ip = require('ip');
var jsoeLoc = "./dist/jsoe/coweb-jsoe-0.8.3/coweb/jsoe";
var evilscan = require('evilscan');
var fileList = [
	["index.html", "index.html"],
	["config.js", "config.js"],
	["main.js", "main.js"],
	["./dist/jsoe/coweb-jsoe-0.8.3/org/requirejs/i18n.js", "org/requirejs/i18n.js"],
	[jsoeLoc + "/nls/messages.js", "coweb/jsoe/nls/messages.js"],
	[jsoeLoc + "/ContextDifference.js", "coweb/jsoe/ContextDifference.js"],
	[jsoeLoc + "/ContextVector.js", "coweb/jsoe/ContextVector.js"],
	[jsoeLoc + "/ContextVectorTable.js", "coweb/jsoe/ContextVectorTable.js"],
	[jsoeLoc + "/DeleteOperation.js", "coweb/jsoe/DeleteOperation.js"],
	[jsoeLoc + "/factory.js", "coweb/jsoe/factory.js"],
	[jsoeLoc + "/HistoryBuffer.js", "coweb/jsoe/HistoryBuffer.js"],
	[jsoeLoc + "/InsertOperation.js", "coweb/jsoe/InsertOperation.js"],
	[jsoeLoc + "/Operation.js", "coweb/jsoe/Operation.js"],
	[jsoeLoc + "/OperationEngine.js", "coweb/jsoe/OperationEngine.js"],
	[jsoeLoc + "/OTEngine.js", "coweb/jsoe/OTEngine.js"],
	[jsoeLoc + "/UpdateOperation.js", "coweb/jsoe/UpdateOperation.js"]
];
var fileContents = {};

var FileLoader = function(local, name) {
	this.name = name;
	this.cb = function(err, data) {
		if (err)
			throw err;
		fileContents[this.name] = data;
	}.bind(this);
	fs.readFile(local, "utf8", this.cb);
};

function loadFiles() {
	for (var i in fileList) {
		new FileLoader(fileList[i][0], fileList[i][1]);
	}
}

function guessMime(fname) {
	var idx = fname.lastIndexOf(".");
	if (idx < 0)
		return "text/html";
	var end = fname.substring(idx + 1);
	switch (end) {
		case "js":
			return "text/javascript";
		default:
			return "text/html";
	}
}

function serveNormalFile(pathname, response) {
	if (fileContents[pathname]) {
		response.writeHead(200, {"Content-Type" : guessMime(pathname)});
		response.write(fileContents[pathname]);
	} else {
		response.writeHead(404, {"Content-Type" : "text/html"});
		response.write("<p style='color: red; font-size: 48px;'>404 not found: " +
            pathname + "</p>");
	}
	response.end();
}
var port = 8889;
var smokeport = 8887
var OTState = function() {

	var peerlist = []
	this.nodeip = ip.address()
	this.node = smoke.createNode({
		port: smokeport
	  , address: smoke.localIp(`${this.nodeip}/255.255.255.0`)
	  //seeds: [{port: 8890, address:this.nodeip}]
	  })
	  this.node.start()
	
	  var options = {
		target :'192.168.178.50-52',
		port    :'8885-8890',
		status  : 'TROU', // Timeout, Refused, Open, Unreachable
		timeout : 3000,
		banner  : true,
		geo	    : true
	};
	
	this.scanner = new evilscan(options);
	this.scanner.run();
	//console.log(this.node.peers.list)
	//Smokesignal -- Create a node with your localip
	//if peerlist empty --> Do host discovery by IP/Port scanning --> ipscanner
	//Add peers to peerlist
	//broadcast your ip to the other peers.
	//get ack.

	//Request a leader election for Sequencer
	//Do the election
	//Receive leader
	

	//If client perform operation assign unique id
	//Broadcast to everyone attaching unique PID
	//Wait for ack for the unique message id and message

	//If received an operation, add it to the holdback queue
	//send it to the peerlist
	//wait for ack from everyone 
	//put it into the operation queue
	this.listeners = [];
	this.queues = {};
	this.engineSyncQueues = {};

	this._order = 0; // This server must give out a total order on operations.
	this._token = 0; // This server must give out unique identifications for each
                    // client when they first connect.
};
var proto = OTState.prototype;

/**
  * Retrieves a unique integer. The function will always return a different
  * value each time it is called.
  * @return unique integer token (will be used as a site id by the client's
  *         OT engine)
  */

proto._addPeer = function(data){
	this.node.addPeer(data.ip,data.port)
//	console.log(data)
	console.log(this.node.peers.list)
}
proto._uniqueToken = function() {
	var ret = this._token;
	++this._token;
	return ret;
};
proto._assignGlobalOrder = function() {
	var ret = this._order;
	++this._order;
	return ret;
};
/**
  * Assigns new client a unique token, and adds client information to internal
  * listener list.
  */
proto.addClient = function() {
	var tok = this._uniqueToken();
	this.listeners.push(tok);
	this.queues[tok] = [];
	this.engineSyncQueues[tok] = [];
	return tok;
};
/**
  * @return queued engine syncs or undefined on any error
  */
proto.getQueuedEngineSyncs = function(token) {
	var client = this.engineSyncQueues[token];
	if (undefined === client)
		return undefined;
	this.engineSyncQueues[token] = [];
	return client;
};
/**
  * @return queued ops or undefined on any error
  */
proto.getQueuedOps = function(token) {
	var client = this.queues[token];
	if (undefined === client)
		return undefined;
	this.queues[token] = [];
	return client;
};
proto.getPeerList = function()
{
	 return this.node.peers
}
/**
  * Pushes an engine sync to all clients except for `site`.
  */
proto.queueEngineSync = function(site, sites) {
	for (var i in this.queues) {
		if (site == i)
			continue; // Only add to other clients' queues.
		this.engineSyncQueues[i].push({site: site, sites: sites});
	}
};
/**
  * Pushes operation to all clients except for `from`.
  */
proto.queueMessage = function(from, op) {
	var order = this._assignGlobalOrder();
	for (var i in this.queues) {
		if (from == i)
			continue; // Only add to other clients' queues.
		this.queues[i].push({"order" : order, "op" : op});
	}
};









var otState = new OTState();
otState.scanner.on('result',function (data) {
	// fired when item is matching options
	
	if(data.status == 'open' && data.port != smokeport && data.ip != this.nodeip)
	{
		otState._addPeer(data)
		console.log(data);
	}
	
});

otState.scanner.on('error',function (err) {
	throw new Error(data.toString());
});

otState.scanner.on('done',function () {
	// finished !
	
	console.log()

});
otState.node.on('connect', function() {
	console.log('HEYO! I\'m here')
	console.log(otState.getPeerList())
  })










var PostHandler = function(request, response, postData) {
	this.request = request;
	this.response = response;
	this.postData = postData;
	this._exec();
};

proto = PostHandler.prototype;
proto.sendJSONResponse = function(obj) {
	this.response.writeHead(200, {"Content-Type" : "application/json"});
	this.response.write(JSON.stringify(obj));
};
proto.sendError = function(code, msg) {
	this.response.writeHead(code, {"Content-Type" : "text/html"});
	this.response.write("<p style='color: red; font-size: 48px;'>" +  msg  +
         "</p>");
};

proto._exec = function() {
	var theParse = url.parse(this.request.url);
	var pathname = theParse.pathname.substring(1);
	if ("admin" == pathname) {
		// Add/remote client from list of updaters.
		var req = JSON.parse(this.postData);
		switch (req.command) {
			case "connect": // When a new client arrives.
				var tok = otState.addClient();
				
				//Ping everyone and get alive list
				//Add client IP to the alivelist -- Broadcast to the other clients
				//Start the election
				//P2P election - LCR algo
				//Leader talks to server -- document -- ping, broadcast the leader -- get the ack
				//Add the JSON to the new client's queue
				this.sendJSONResponse({"status" : "success", "token" : tok});
				break;
			case "fetch": // When a client requests updates.
				var tok = req.site;
				if (undefined === tok) {
					this.sendError(400, "Malformed request");
					response.end();
					return;
				}
				var ops = otState.getQueuedOps(tok);
				var engineSyncs = otState.getQueuedEngineSyncs(tok);
			
				if (undefined === ops) {
					this.sendError(400, "Malformed request");
					response.end();
					return;
				}
				this.sendJSONResponse({"status" : "success", "ops": ops,
                  "engineSyncs": engineSyncs});
				break;
			default:
				this.sendError(400, "Invalid 'admin' request.");
		}
	} else if ("engineSync" == pathname) {
		/* Queue up the engine sync for other clients. */
		var sync = JSON.parse(this.postData);
		otState.queueEngineSync(sync.site, sync.sites);
		this.response.writeHead(200, {});
		this.response.write(JSON.stringify({"status": "success"}));
	} else if ("ot" == pathname) {
		/* Take the message, append a total order to it, and save it in each
         listener's queue (except for the sender). */
		var otMsg = JSON.parse(this.postData);
		otState.queueMessage(otMsg.site, otMsg.op);
		this.response.writeHead(200, {});
	} else {
		this.sendError(400, "Bad post request");
	}
	this.response.end();
};

function handlePost(request, response) {
	var postData = "";
	request.setEncoding("utf8");
	request.addListener("data", function(chunk) {
		postData += chunk;
	});
	request.addListener("end", function() {
		var hndl = new PostHandler(request, response, postData);
	});
}


if (process.argv[2])
	port = process.argv[2];

// Read file contents into memory.
loadFiles();

// Start server.
// var server = http.createServer(function(request, response) {
// 	var theParse = url.parse(request.url);
// 	var pathname = theParse.pathname.substring(1);
// 	switch (request.method.toUpperCase()) {
// 		case "GET":
// 			serveNormalFile(pathname, response);
// 			break;
// 		case "POST":
// 			handlePost(request, response);
// 			break;
// 	}
// }).listen(port);
// var io = require("socket.io")(http).listen(server)
// io.on('connection', function(socket){
// 	console.log('a user connected');
//   });
// process.stdout.write("Listening on " + port + "\n");
