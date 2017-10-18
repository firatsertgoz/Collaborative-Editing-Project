var app = require('express')();
var http = require('http');
var fs = require("fs");
var url = require("url");
var querystring = require("querystring");
var smoke = require('smokesignal')
var ip = require('ip');
var jsoeLoc = "./dist/jsoe/coweb-jsoe-0.8.3/coweb/jsoe";
var evilscan = require('evilscan');
var streams = require('memory-streams');
const readline = require('readline');
var OTEngine = require("coweb-jsoe").OTEngine
var jsesc = require('jsesc');

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
var ack = new streams.ReadableStream("acknowledge")
var fileContents = {};
var portnumber = process.argv[2]

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
var smokeport = 8887
var OTState = function() {
	
	this.processId = Math.random()
	this.nodeip = ip.address()
	this.node = smoke.createNode({
		port: portnumber
	  , address: smoke.localIp(`${this.nodeip}/255.255.255.0`)
	  //seeds: [{port: 8890, address:this.nodeip}]
	  })
	  this.node.start()
	
	  var options = {
		target : this.nodeip,
		port    :'8885-8890',
		status  : 'TROU', // Timeout, Refused, Open, Unreachable
		timeout : 3000,
		banner  : true,
		geo	    : true
	};
	this.ote = new OTEngine(this.node.id)
	this.scanner = new evilscan(options);
	this.scanner.run();
	//console.log(this.node.peers.list)
	//Smokesignal -- Create a node with your localip
	//if peerlist empty --> Do host discovery by IP/Port scanning --> ipscanner
	//Add peers to peerlist
	//broadcast your ip to the other peers.
	//get ack. Done

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
	this.unack_queue = [];
	this.holdbackqueue = [];
	this.orderformessage = [];
	this.listeners = [];
	this.queues = {};
	this.engineSyncQueues = {};
	this.isLeader = false
	this.leaderPID = 0;
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
//	console.log("Adding the peer:" + data.ip + " " +data.port)
}
proto._broadcastAddress = function()
{
	var reader = new streams.ReadableStream(JSON.stringify({"nodeip" :jsesc(otState.nodeip),"portnumber":portnumber,"type":"ipbroadcast"}));
	// Get the newly joined peer, broadcast it to other peers, other peers add the newly added peer to their peerlist.
	//reader.pipe(this.node.broadcast)
}

proto._requestLatestList = function()
{

}
proto._uniqueToken = function() {
	var ret = this._token;
	++this._token;
	return ret;
};
proto._sendOperations = function(operation)
{
	
	var pos, val, type;

	pos = operation[1];
	val = operation[0];
	type = operation[2]
	if(type == 'insert'){
		var op = this.ote.createOp("change", val, "insert", pos);
		var operationtosend = ""
		var messageId = Math.random()
		if(this.isLeader)
		otState.node.peers.list.forEach(function(peer) {
			var currentpeerid = peer.id
			operationtosend = JSON.stringify({"operation" :op,"processId":this.node.id,"messageId":messageId,"ack":false,"ordermarker": this._assignGlobalOrder,"type":"unack-operation","tobeackId":currentpeerid})			
			otState.unack_queue.push(JSON.parse(operationtosend))
		},this);		
		else
		otState.node.peers.list.forEach(function(peer) {
			var currentpeerid = peer.id
			operationtosend = JSON.stringify({"operation" :op,"processId":this.node.id,"messageId":messageId,"ack":false,"ordermarker": null,"type":"unack-operation","tobeackId":currentpeerid})			
			otState.unack_queue.push(JSON.parse(operationtosend))
		},this);
		console.log("I am sending with this Id:" + " " +this.node.id)
		new streams.ReadableStream(operationtosend).pipe(this.node.broadcast)
	}
	else if(type == 'delete'){
		var op = this.ote.createOp("change", val, "delete", pos);
		var operationtosend = ""
		var messageId = Math.random()
		if(this.isLeader)
		otState.node.peers.list.forEach(function(peer) {
			var currentpeerid = peer.id
			operationtosend = JSON.stringify({"operation" :op,"processId":this.node.id,"messageId":messageId,"ack":false,"ordermarker": this._assignGlobalOrder,"type":"unack-operation","tobeackId":currentpeerid})			
			otState.unack_queue.push(JSON.parse(operationtosend))
		},this);	
		else
		otState.node.peers.list.forEach(function(peer) {
			var currentpeerid = peer.id
			//console.log(currentpeerid)
			operationtosend = JSON.stringify({"operation" :op,"processId":this.node.id,"messageId":messageId,"ack":false,"ordermarker": null,"type":"unack-operation","tobeackId":currentpeerid})			
			//console.log(operationtosend)
			otState.unack_queue.push(JSON.parse(operationtosend))
		},this);
		new streams.ReadableStream(operationtosend).pipe(this.node.broadcast)
	}
	else if(type == 'update'){
		var op = this.ote.createOp("change", val, "update", pos);
		var operationtosend = ""
		var messageId = Math.random()
		if(this.isLeader)
		otState.node.peers.list.forEach(function(peer) {
			var currentpeerid = peer.id
			operationtosend = JSON.stringify({"operation" :op,"processId":this.node.id,"messageId":messageId,"ack":false,"ordermarker": this._assignGlobalOrder,"type":"unack-operation","tobeackId":currentpeerid})			
			otState.unack_queue.push(JSON.parse(operationtosend))
		},this);	
		else
		otState.node.peers.list.forEach(function(peer) {
			var currentpeerid = peer.id
			//console.log(currentpeerid)
			operationtosend = JSON.stringify({"operation" :op,"processId":this.node.id,"messageId":messageId,"ack":false,"ordermarker": null,"type":"unack-operation","tobeackId":currentpeerid})			
			//console.log(operationtosend)
			otState.unack_queue.push(JSON.parse(operationtosend))
		},this);
		new streams.ReadableStream(operationtosend).pipe(this.node.broadcast)
	}
	/* OTEngine local insert event. */
	//var op = ote.createOp("change", val, "insert", pos);
	//comm.sendOp(ote.localEvent(op));
	//shouldSync = true;
}
proto._requestElection = function()
{

	return leader
}


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
proto._startListeningPeer = function(peer){
	peer.socket.data('write',function(chunk){
		//console.log(chunk)
		var jsonData = JSON.parse(chunk.toString().trim())
			if(jsonData.type == 'ack-operation'){	
				if(jsonData.ordermarker != null) otState.orderformessage.push({"messageId":jsonData.messageId,"order":jsonData.ordermarker})		
				otState.unack_queue = otState.unack_queue.filter(function(receivedpeer){
						return receivedpeer.tobeackId !== jsonData.processId
					})
			console.log("The message " + jsonData.messageId +"has been acknowledged by: " + jsonData.processId)
			if(otState.unack_queue.find(function(unackmessage){
				return unackmessage.messageId == jsonData.messageId
			}) == undefined)
			{
				jsonData.ordermarker = otState.orderformessage.find(function(message){
					var messageholdingorder = message.messageId == jsonData.messageId
					return messageholdingorder.order
				})
				delete jsonData.tobeackId
				if(otState.holdbackqueue.find(function(operation){
					return operation.messageId == jsonData.messageId
				}) == undefined )
				otState.holdbackqueue.push(jsonData)
				console.log("THIS IS THE HOLDBACK")
				console.log(otState.holdbackqueue)
			}
		}
		else if(jsonData.type == "unack-operation"){
			var tobeack = JSON.parse(JSON.stringify(jsonData));
			tobeack.ack = true
			tobeack.type = "ack-operation"
			tobeack.processId = otState.node.id
			if(otState.leaderPID == otState.node.id)
			tobeack.ordermarker = otState._assignGlobalOrder
			var ownerpeer = otState.node.peers.list.find(peer =>{
				return peer.id.toString() == jsonData.processId.toString()
			})
			ownerpeer.socket.send("write",JSON.stringify(tobeack))
		}
	})
};







//Get input from the console, depending on the type of the input put the operation in the holdback queue and broadcast the
//operation to other peers.
var otState = new OTState();
var operation = process.stdin

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
  });
  rl.on('line', (input) => {
	var operationArray = input.toString().trim().split('-')
	var last_element = operationArray[operationArray.length - 1];
	if(last_element == 'insert'){
		otState._sendOperations(operationArray)
		//new streams.ReadableStream(input).pipe(otState.node.broadcast)
		}
		else if(last_element == 'delete'){
			otState._sendOperations(operationArray)
			//new streams.ReadableStream(input).pipe(otState.node.broadcast)
		}
		else if(last_element == 'update'){
			otState._sendOperations(operationArray)
		//	new streams.ReadableStream(input).pipe(otState.node.broadcast)
		}
		else{
		}
  });  



otState.scanner.on('result',function (data) {
	// fired when item is matching options
	
	if(data.status == 'open' && data.port != portnumber && data.ip != this.nodeip)
	{
		otState._addPeer(data)
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
	
	// Initialize with the string
	otState._broadcastAddress()
  })

//When a new peer is connected to the node
otState.node.on('new peer',function(peer){
		console.log("LOOK A NEW PEER")
		otState._startListeningPeer(peer)
		});




 
  //Broadcast callback for all the data
otState.node.broadcast.on('data',function(chunk)
{
	var jsonData = JSON.parse(chunk.toString().trim())
	
		if(jsonData.type == 'ipbroadcast'){
		//this.node.addPeer(jsonData.nodeip,jsonData.portnumber)
		console.log("Adding the newly joined peer:" + jsonData.nodeip + jsonData.portnumber)
		}

		else if(jsonData.type == 'unack-operation'){
			//Broadcast unack operation to everybody except the sender
			//var tobeack = jsonData
			//var passonmessage =jsonData
			//passonmessage.processId = otState.node.id
			//tobeack.ack = true
			//tobeack.processId = otState.node.id
			//tobeack.type = "ack-operation"
			var Peerlistofthisnode = otState.node.peers.list
			var ownerpeer = otState.node.peers.list.find(peer =>{
				return peer.id.toString() == jsonData.processId.toString()
			})
			var tobeack = JSON.parse(JSON.stringify(jsonData)); //Clone the object
			var tobepassed = JSON.parse(JSON.stringify(jsonData));
			if(otState.leaderPID == otState.node.id) tobepassed.ordermarker = otState._assignGlobalOrder
			tobepassed.processId = otState.node.id
			otState.node.peers.list.forEach(function(peer){
				if(peer.id != ownerpeer.id)
				{
					console.log('I am passing on this message to : ' + peer.id )
					tobepassed.tobeackId = peer.id
					otState.unack_queue.push(tobepassed)
					console.log("THIS IS THE UNACKQUEUE")
					console.log(otState.unack_queue)
					peer.socket.send("write",JSON.stringify(tobepassed))
				}
			})
			tobeack.ack = true
			tobeack.type = "ack-operation"
			tobeack.processId = otState.node.id
		ownerpeer.socket.send("write",JSON.stringify(tobeack))
		}
		else
		{
			console.log(jsonData)
		}
	});



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
