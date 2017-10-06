var app = require('./app');
var port = process.env.port || 3000;
var http = require("http");
var url = require("url");
var OT = require("coweb-jsoe").OTEngine
var querystring = require("querystring");

var OTState = function() {
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
				/* Really, we should be more careful about errors, since some syncs
               might get lost (for example, getQueuedOps succeeds, but
               getQueuedEngineSyncs fails).*/
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

var port = 8889;
if (process.argv[2])
	port = process.argv[2];


// Start server.
http.createServer(function(request, response) {
	var theParse = url.parse(request.url);
	var pathname = theParse.pathname.substring(1);
	switch (request.method.toUpperCase()) {
		case "GET":
			serveNormalFile(pathname, response);
			break;
		case "POST":
			handlePost(request, response);
			break;
	}
}).listen(port);

process.stdout.write("Listening on " + port + "\n");
