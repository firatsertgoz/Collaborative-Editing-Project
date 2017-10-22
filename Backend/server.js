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
const spawn = require('threads').spawn;
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
//SiteID
var uniqueid = process.argv[4]
var fileContents = {};
//Portnumber for the Node
var portnumber = process.argv[2]
//Leader for now
var fortharg = process.argv[3]
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
	
	this.electionState = false
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
	this.ote = new OTEngine(parseInt(uniqueid))
	this.scanner = new evilscan(options);
	this.scanner.run();
	this.latencynumber = Math.floor(Math.random() * (3 - 0 + 1)) + 0;
	this.operationhistory = []
	this.receivedpeernumber = 0
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
	this.thread = spawn(function(otState, done) {
		// Everything we do here will be run in parallel in another execution context. 
		// Remember that this function will be executed in the thread's context, 
		// so you cannot reference any value of the surrounding code. 
		if(otState.unack_queue.length > 0)
		{
			otState.unack_queue.forEach(function(message){
				var ownerpeer = otState.node.peers.list.find(peer =>{
					return peer.id.toString() == message.tobeackId.toString()
				})
				ownerpeer.socket.send("write",JSON.stringify(message))
			})
		}

		done({ unack_queue : otState.unack_queue });
	  });
	this.unack_queue = [];
	this.holdbackqueue = [];
	this.orderformessage = [];
	this.thelist =[];
	this.listeners = [];
	this.queues = {};
	this.engineSyncQueues = {};
	this.isLeader = false
	this.leaderPID 
	this._order = 0; // This server must give out a total order on operations.
	this._token = 0; // This server must give out unique identifications for each
					// client when they first connect.
	//if(this.node.peers.list.length > 0)
};
var proto = OTState.prototype;
//Add peer to the peerlist of the Node
proto._addPeer = function(data){
	this.node.addPeer(data.ip,data.port)
//	console.log("Adding the peer:" + data.ip + " " +data.port)
}

//Broadcast the IP address and the Port Number of the Node, No need after host discovery being automatic.
proto._broadcastAddress = function()
{
	var reader = new streams.ReadableStream(JSON.stringify({"nodeip" :jsesc(otState.nodeip),"portnumber":portnumber,"type":"ipbroadcast"}));
	// Get the newly joined peer, broadcast it to other peers, other peers add the newly added peer to their peerlist.
	//reader.pipe(this.node.broadcast)
}

//After a new client connects to the network, it requests the latest document from the leader and shares its state with the rest of the network while syncing with them.
proto._requestLatestList = function()
{
	// if(this.node.peers.list.length > 0 && !this.isLeader)
	// {
	// var leaderpeer = this.node.peers.list.find(function(peer){
	// 	console.log(peer.socket.port)
	// 	return peer.socket.port == otState.leaderPID 
	// })
	if(this.node.peers.list.length > 0 ){
	//leaderpeer.socket.send("write",JSON.stringify({"type":"latestDocReq","processId":this.node.id}))
	var myengine = otState.ote.syncOutbound()
	new streams.ReadableStream(JSON.stringify({"type":"firstTimeSync","site":uniqueid,"processId":this.node.id,"myEngine":myengine})).pipe(this.node.broadcast)
	new streams.ReadableStream(JSON.stringify({"type":"OrderHistory","site":uniqueid,"processId":this.node.id})).pipe(this.node.broadcast)
}
	else
	console.log("No peer yet")
}
proto._uniqueToken = function() {
	var ret = this._token;
	++this._token;
	return ret;
};
//Send the operations received from the console. Broadcast the operations with according to their type. 
//If the node is the leader also assign the total order.
proto._sendOperations = function(operation)
{
	
	var pos, val, type;

	pos = operation[1];
	val = operation[0];
	type = operation[2]
	if(type == 'insert'){
		var op = this.ote.localEvent(this.ote.createOp("change", val, "insert", pos));
		var engineSync = this.ote.syncOutbound()
		var operationtosend = ""
		var messageId = Math.random()
		if(this.isLeader){
			globalorder = this._assignGlobalOrder()
		otState.node.peers.list.forEach(function(peer) {
			var currentpeerid = peer.id	
			operationtosend = JSON.stringify({"operation" :op,"engineSync": engineSync,"processId":this.node.id,"messageId":messageId,"ack":false,"ordermarker": globalorder ,"type":"unack-operation","tobeackId":currentpeerid})			
			otState.unack_queue.push(JSON.parse(operationtosend))
			
		},this);
		console.log("I am sending with this Id:" + " " +this.node.id)
		new streams.ReadableStream(operationtosend).pipe(this.node.broadcast)}
		else
		{
		otState.node.peers.list.forEach(function(peer) {
			var currentpeerid = peer.id
			operationtosend = JSON.stringify({"operation" :op,"engineSync": engineSync,"processId":this.node.id,"messageId":messageId,"ack":false,"ordermarker": null,"type":"unack-operation","tobeackId":currentpeerid})			
			otState.unack_queue.push(JSON.parse(operationtosend))
		},this);
		console.log("I am sending with this Id:" + " " +this.node.id)
		new streams.ReadableStream(operationtosend).pipe(this.node.broadcast)
		}
	}
	else if(type == 'delete'){
		var op = this.ote.localEvent(this.ote.createOp("change", val, "delete", pos));
		var operationtosend = ""
		var messageId = Math.random()
		var engineSync = this.ote.syncOutbound()
		if(this.isLeader)
		{
			globalorder = this._assignGlobalOrder()
		otState.node.peers.list.forEach(function(peer) {
			var currentpeerid = peer.id

			operationtosend = JSON.stringify({"operation" :op,"engineSync": engineSync,"processId":this.node.id,"messageId":messageId,"ack":false,"ordermarker": globalorder,"type":"unack-operation","tobeackId":currentpeerid})			
			otState.unack_queue.push(JSON.parse(operationtosend))
		},this);	console.log("I am sending with this Id:" + " " +this.node.id)
		new streams.ReadableStream(operationtosend).pipe(this.node.broadcast)}
		else
		{
		otState.node.peers.list.forEach(function(peer) {
			var currentpeerid = peer.id
		
			operationtosend = JSON.stringify({"operation" :op,"engineSync": engineSync,"processId":this.node.id,"messageId":messageId,"ack":false,"ordermarker": null,"type":"unack-operation","tobeackId":currentpeerid})			
			
			otState.unack_queue.push(JSON.parse(operationtosend))
		},this);
		new streams.ReadableStream(operationtosend).pipe(this.node.broadcast)
	}
	}
	else if(type == 'update'){
		var op = this.ote.localEvent(this.ote.createOp("change", val, "update", pos));
		var operationtosend = ""
		var messageId = Math.random()
		var engineSync = this.ote.syncOutbound()
		if(this.isLeader){
			globalorder = this._assignGlobalOrder()
		otState.node.peers.list.forEach(function(peer) {
			var currentpeerid = peer.id
			operationtosend = JSON.stringify({"operation" :op,"engineSync": engineSync,"processId":this.node.id,"messageId":messageId,"ack":false,"ordermarker": globalorder,"type":"unack-operation","tobeackId":currentpeerid})			
			otState.unack_queue.push(JSON.parse(operationtosend))
		},this);
		console.log("I am sending with this Id:" + " " +this.node.id)
		new streams.ReadableStream(operationtosend).pipe(this.node.broadcast)	}
		else
		{
		otState.node.peers.list.forEach(function(peer) {
			var currentpeerid = peer.id
	
			operationtosend = JSON.stringify({"operation" :op,"engineSync": engineSync,"processId":this.node.id,"messageId":messageId,"ack":false,"ordermarker": null,"type":"unack-operation","tobeackId":currentpeerid})			
	
			otState.unack_queue.push(JSON.parse(operationtosend))
		},this);
		new streams.ReadableStream(operationtosend).pipe(this.node.broadcast)
	}}
	/* OTEngine local insert event. */
	//var op = ote.createOp("change", val, "insert", pos);
	//comm.sendOp(ote.localEvent(op));
	//shouldSync = true;
}

proto._requestElection = function()
{

	return leader
}

//Global order assigning by the leader
proto._assignGlobalOrder = function() {
	var ret = this._order;
	++this._order;
	return ret;
};

proto.getPeerList = function()
{
	 return this.node.peers
}
/**
  * Pushes an engine sync to all clients except for `site`.
  */
/**
  * Pushes operation to all clients except for `from`.
  */


//Start listening to the socket of the Peers after they connect to the network.
proto._startListeningPeer = function(peer){
	peer.socket.data('write',function(chunk){
		
		var jsonData = JSON.parse(chunk.toString().trim())
			if(jsonData.type == 'ack-operation'){	
				if(jsonData.ordermarker != null && otState.orderformessage.find(function(message){
					return message.messageId == jsonData.messageId
				}) == undefined) otState.orderformessage.push({"messageId":jsonData.messageId,"order":jsonData.ordermarker,"checked":false})		
			
				otState.unack_queue = otState.unack_queue.filter(function(receivedpeer){
						return receivedpeer.tobeackId !== jsonData.processId
					})
			console.log("The message " + jsonData.messageId +"has been acknowledged by: " + jsonData.processId)
			console.log(otState.orderformessage)
			if(otState.unack_queue.find(function(unackmessage){
				return unackmessage.messageId == jsonData.messageId
			}) == undefined)
		{ console.log("No unack ready to roll")
				var orderoftheoperation = otState.orderformessage.find(function(message){
					return message.messageId == jsonData.messageId
				})
				if(orderoftheoperation != undefined)
				jsonData.ordermarker  = orderoftheoperation.order
				delete jsonData.tobeackId
				if(otState.holdbackqueue.find(function(operation){
					return operation.messageId == jsonData.messageId
				}) == undefined )
				otState.holdbackqueue.push(jsonData)
				console.log(otState.holdbackqueue)
				nextoperation = otState.holdbackqueue.shift()
				var operationorderexists = otState.orderformessage.find(function(message){
					return message.messageId == nextoperation.messageId})
					otState.ote.syncInbound(nextoperation.operation.site,nextoperation.engineSync)
					otState.ote.purge()
				if(nextoperation.operation.site != uniqueid && operationorderexists != undefined && operationorderexists.checked == false){
					console.log(nextoperation.operation.sites)
					var op = otState.ote.remoteEvent(nextoperation.ordermarker,nextoperation.operation)
					otState.operationhistory.push({"order":nextoperation.ordermarker,"operation":op})
					console.log(otState.operationhistory)
				if(op.type == "insert" && operationorderexists.checked == false){
					otState.thelist.splice(op.position, 0, op.value);
					operationorderexists.checked =true
				}
				else if(op.type == "update" && operationorderexists != undefined && operationorderexists.checked == false){
					otState.thelist[op.position] = op.value;
					operationorderexists.checked =true
				}
				else if(op.type == "delete" && operationorderexists != undefined && operationorderexists.checked == false){
					otState.thelist.splice(op.position, 1);
					operationorderexists.checked =true
				}
			}
			else
			{
				otState.operationhistory.push({"order":nextoperation.ordermarker,"operation":nextoperation.operation})
				if(nextoperation.operation.type == "insert" && operationorderexists != undefined && operationorderexists.checked == false){
					otState.thelist.splice(nextoperation.operation.position, 0, JSON.parse(nextoperation.operation.value));
					operationorderexists.checked =true
				}
				else if(nextoperation.operation.type == "update" && operationorderexists != undefined &&operationorderexists.checked == false){
					otState.thelist[nextoperation.operation.position] = nextoperation.operation.value;
					operationorderexists.checked =true
				}
				else if(nextoperation.operation.type == "delete" && operationorderexists != undefined&&  operationorderexists.checked == false){
					otState.thelist.splice(nextoperation.operation.position, 1);
					operationorderexists.checked =true
				}
			}
				console.log(otState.thelist)
			}
		}
		else if(jsonData.type == "unack-operation"){
			var tobeack = JSON.parse(JSON.stringify(jsonData));
			if(tobeack.ordermarker != null && otState.orderformessage.find(function(message){
				return message.messageId == jsonData.messageId
			}) == undefined) otState.orderformessage.push({"messageId":jsonData.messageId,"order":jsonData.ordermarker,"checked":false})
			tobeack.ack = true
			tobeack.type = "ack-operation"
			otState.ote.syncInbound(jsonData.site,jsonData.engineSync)
			var engineSync = otState.ote.syncOutbound()
			tobeack.engineSync = engineSync
			tobeack.processId = otState.node.id
			if(otState.isLeader && tobeack.ordermarker == null && otState.orderformessage.find(function(message){
				return message.messageId == tobeack.messageId
			}) == undefined){
			tobeack.ordermarker = otState._assignGlobalOrder()
			}
			else if(tobeack.ordermarker == null){
			var orderoftheoperation = otState.orderformessage.find(function(message){
				return message.messageId == jsonData.messageId
			})
				if(orderoftheoperation != undefined)
				tobeack.ordermarker = orderoftheoperation.ordermarker
			}
			var ownerpeer = otState.node.peers.list.find(peer =>{
				return peer.id.toString() == jsonData.processId.toString()
			})
			
		ownerpeer.socket.send("write",JSON.stringify(tobeack))
		}
		else if(jsonData.type == "latestDocReq"){
			var ownerpeer = otState.node.peers.list.find(peer =>{
				return peer.id.toString() == jsonData.processId.toString()
			})
			ownerpeer.socket.send("write",JSON.stringify({"theList": otState.thelist,"type":"latestDocResp"}))
		}
		else if(jsonData.type == "latestDocResp"){
			console.log(jsonData.theList)
			otState.thelist = jsonData.theList
		}
		else if(jsonData.type == "firstTimeSync"){
			var engineSync = this.ote.syncOutbound()
			var processId = this.node.id
			var ownerpeer = otState.node.peers.list.find(peer =>{
				return peer.id.toString() == jsonData.processId.toString()
			})

			ownerpeer.socket.send("write",JSON.stringify({"EngineSync":engineSync,"type":"firstTimeSyncResp","site": uniqueid}))
			
		}
		else if(jsonData.type == "firstTimeSyncResp"){
			//otState.ote.syncInbound(jsonData.site,jsonData.engineoutbound)
		}
		else if(jsonData.type == "operationHistoryResp"){
			if(otState.operationhistory.length < jsonData.operationHistory.length)
			otState.operationhistory = jsonData.operationHistory
			otState.receivedpeernumber++
			if(otState.node.peers.list.length == otState.receivedpeernumber){
			otState.operationhistory.forEach(function(operation){
				
				if(operation.operation.type == "insert"){
					otState.thelist.splice(operation.operation.position, 0, operation.operation.value);
					//console.log(operation)
					
				}
				else if(operation.operation.type == "update"){
					otState.thelist[operation.operation.position] = operation.operation.value;
					//console.log(operation)
				}
				else if(operation.operation.type == "delete" ){
					otState.thelist.splice(operation.operation.position, 1);
					//console.log(operation)
				}
			})
			console.log(otState.thelist)
		}
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
	if(last_element == 'insert' && otState.electionState == false){
		otState._sendOperations(operationArray)
		
		// 	setInterval(otState.thread.send(otState).on('message',function(response){
		// 	console.log(response)
		// 	otState.thread.kill();
		// }),5000)
		//new streams.ReadableStream(input).pipe(otState.node.broadcast)
		}
		else if(last_element == 'delete'  && otState.electionState == false){
			otState._sendOperations(operationArray)
			// setInterval(otState.thread.send(otState).on('message',function(response){
			// 	console.log(response)
			// 	otState.thread.kill();
			// }),5000)
			//new streams.ReadableStream(input).pipe(otState.node.broadcast)
		}
		else if(last_element == 'update'  && otState.electionState == false){
			otState._sendOperations(operationArray)
			// setInterval(otState.thread.send(otState).on('message',function(response){
			// 	console.log(response)
			// 	otState.thread.kill();
			// }),5000)
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
	otState._requestLatestList()
  })

//When a new peer is connected to the node
otState.node.on('new peer',function(peer){
		console.log("New peer added to the network with ID: "+ peer.id)
		if(!otState.isLeader){
		var leaderpeer = otState.node.peers.list.find(function(peer){
			return peer.socket.port == fortharg.trim()
			})
		otState.leaderPID = leaderpeer.id
							}
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
		

			var Peerlistofthisnode = otState.node.peers.list
			var ownerpeer = otState.node.peers.list.find(peer =>{
				return peer.id.toString() == jsonData.processId.toString()
			})
			var tobeack = JSON.parse(JSON.stringify(jsonData)); //Clone the object
			var tobepassed = JSON.parse(JSON.stringify(jsonData));
			if(otState.isLeader && tobeack.ordermarker == null && otState.orderformessage.find(function(message){
				return message.messageId == tobeack.messageId
			}) == undefined){
				var orderforeveryone = otState._assignGlobalOrder()
				tobeack.ordermarker = orderforeveryone
				tobepassed.ordermarker = orderforeveryone
				otState.orderformessage.push({"messageId":jsonData.messageId,"order":tobeack.ordermarker,"checked":false})
			} 
			tobeack.ack = true
			tobeack.type = "ack-operation"
			tobeack.processId = otState.node.id
			tobepassed.processId = otState.node.id
			otState.node.peers.list.forEach(function(peer){
				if(peer.id != ownerpeer.id)
				{
					tobepassed.tobeackId = peer.id
					otState.unack_queue.push(tobepassed)
					peer.socket.send("write",JSON.stringify(tobepassed))
				}
			})
	
		ownerpeer.socket.send("write",JSON.stringify(tobeack))
		}
		else if(jsonData.type == "engineRequest")
		{
			otState.ote.syncInbound(jsonData.site,jsonData.OutboundSync)
			var ownerpeer = otState.node.peers.list.find(peer =>{
				return peer.id.toString() == jsonData.processId.toString()
			})
			var engineoutbound = JSON.parse(JSON.stringify(jsonData));
			engineoutbound.OutboundSync = otState.ote.syncOutbound()
			engineoutbound.site = uniqueid
			engineoutbound.type = "firstTimeSync"
			ownerpeer.socket.send("write",JSON.stringify(engineoutbound))
		}
		else if(jsonData.type == "firstTimeSync"){

			var engineSync = otState.ote.syncOutbound()
			var processId = otState.node.id
			otState.ote.syncInbound(jsonData.site,jsonData.myEngine)
			var ownerpeer = otState.node.peers.list.find(peer =>{
				return peer.id.toString() == jsonData.processId.toString()
			})

			ownerpeer.socket.send("write",JSON.stringify({"EngineSync":engineSync,"type":"firstTimeSyncResp","site": uniqueid}))	
		}
		else if(jsonData.type == "OrderHistory"){
			var ownerpeer = otState.node.peers.list.find(peer =>{
				return peer.id.toString() == jsonData.processId.toString()
			})
			var ophist = otState.operationhistory
			ownerpeer.socket.send("write",JSON.stringify({"operationHistory":ophist,"type":"operationHistoryResp","site": uniqueid}))	
		}
	});


if (process.argv[2])
	port = process.argv[2];
if (process.argv[3])
	{
		var leader = process.argv[3]
		if(leader == port)
		{
			otState.leaderPID = otState.node.id
			otState.isLeader = true
			console.log('I AM  THE LEADER')
		}
		else
		{
			fortharg = process.argv[3]
			otState.leaderPID = parseInt(fortharg.trim())
		}
	}

// Read file contents into memory.
loadFiles();
// setInterval(function() {
// 	engine = otState.ote.syncOutbound()
//     new streams.ReadableStream(JSON.stringify({"stateengine" :engine,"type":"engine"})).pipe(otState.node.broadcast)
// }, 10 * 1000);
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
