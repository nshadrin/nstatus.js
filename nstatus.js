#!/usr/bin/env nodejs

console.log('Loading ...');
var blessed = require('blessed');
var nstatus = require('http');
var process = require('process');
var http = require('http');
var url = require('url');
var fs = require("fs");
var argv = require('yargs')
	.usage('Usage: $0 [options] <url>')
	.help('h')
	.alias('h', 'help')
	.boolean('s')
	.default('s', false)
	.alias('s', 'simple')
	.describe('s', 'Simple view mode on')
	.example('$0 http://demo.nginx.com/status', 'Shows stats from demo.nginx.com/status')
	.demand(1)
	.argv;

var statusURL = argv._[0];
var simpleView = argv.s;

var Mark = require("markup-js");
var templateMain =		fs.readFileSync("templates/main.txt", "utf8");
var templateTitle =		fs.readFileSync("templates/title.txt", "utf8");
var templateHttpZones =		fs.readFileSync("templates/http_zones.txt", "utf8");
var templateStreamZones =	fs.readFileSync("templates/stream_zones.txt", "utf8");
var templateStreamUpstreams =	fs.readFileSync("templates/stream_upstreams.txt", "utf8");
var templateHttpUpstreams = fs.readFileSync("templates/http_upstreams.txt", "utf8");

var tabview = 1;
var olddata = '';
var jsondata = '';
var refreshRate = 500; //ms


function loadScreen() {
	screen = blessed.screen({
		smartCSR: true
	});

	screen.title = 'NGINX Plus Dashboard';
	layout = blessed.layout({
		parent: screen,
		top: 'center',
		scrollable: true,
		alwaysScroll: true,
		left: 'center',
		width: '100%',
		height: '100%',
		border: 'line',
		style: {
			bg: '#050000',
			border: {
				fg: 'blue'
			}
		},

	});

	box = blessed.box({
		parent: layout,
		width: '100%',
		height: 'shrink',
		scrollbar: false,
		top: '0',
		tags: true,
		content: "\n\n{center}Waiting for data from NGINX Plus...{/center}",
		border: {
			type: 'none'
		},
		style: {
			header: {
				fg: '#98FB98',
				bg: 'blue'
			},
			fg: '#98FB98',
			bg: '#000000'
		}
	});
	table = blessed.table({
		parent: layout,
		width: '100%',
		height: 'shrink',
		tags: true,
		pad: 0,
		noCellBorders: 1,
		style: {
			cell: {
				fg: '#98FB98',
				bg: '#000000'
			},
			header: {
				fg: '#FFFFFF',
				bg: '#004400'
			}
		}
	});

	box.key('enter', function(ch, key) {
		loadStatus();
	});

	screen.key(['q', 'C-c'], function(ch, key) {
		screen.destroy();
		console.log('Thanks for using nstatus.js. https://github.com/nshadrin/nstatus.js');
		return process.exit(0);
	});

	screen.key(['1','0','escape'], function(ch, key) { tabview = 1; drawScreen(); });
	screen.key(['2'], function(ch, key) { tabview = 2; drawScreen(); });
	screen.key(['3'], function(ch, key) { tabview = 3; drawScreen(); });
	screen.key(['4'], function(ch, key) { tabview = 4; drawScreen(); });
	screen.key(['5'], function(ch, key) { tabview = 5; drawScreen(); });
	screen.key(['6'], function(ch, key) { tabview = 6; drawScreen(); });

	screen.key(['down'], function(ch, key) { layout.scroll(2); screen.render(); });
	screen.key(['up'], function(ch, key) { layout.scroll(-2); screen.render(); });

	screen.key(['s'], function(ch, key) {
		 simpleView = !simpleView;
		 if (tabview == 3) {
			 drawScreen();
		 }
	  });

	box.focus();
	screen.render();
}

function generateUpstreamTable(objectJson){
	var data = [];
	data[0] = [
		"IP",
		"W",
		"Requests",
		"1xx",
		"2xx",
		"3xx",
		"4xx",
		"5xx",
		"Sent",
		"Received",
		"Checks",
		"Fails",
		"Unhealthy"

	];
	for(var x in objectJson){
		data[data.length] = [ "{blue-bg}" + x + "{/grey-bg}"];
		for(var y in objectJson[x].peers){
			linearr = [];
			var colorOpen = '';
			var colorClose = '';
			switch(JSON.stringify(objectJson[x].peers[y].state)){
				case '"up"':
					colorOpen = "{green-fg}";
					colorClose = "{/green-fg}";

					break;
				case '"drain"':
					colorOpen = "{blue-fg}";
					colorClose = "{/blue-fg}";
					break;
				case '"down"':
					colorOpen = "{grey-fg}";
					colorClose = "{/grey-fg}";
					break;

				default:
					colorOpen = "{red-fg}";
					colorClose = "{/red-fg}";
					break;

			}
			linearr.push(
				colorOpen + objectJson[x].peers[y].server + colorClose,
				JSON.stringify(objectJson[x].peers[y].weight),
				JSON.stringify(objectJson[x].peers[y].requests),
				JSON.stringify(objectJson[x].peers[y].responses["1xx"]),
				JSON.stringify(objectJson[x].peers[y].responses["2xx"]),
				JSON.stringify(objectJson[x].peers[y].responses["3xx"]),
				JSON.stringify(objectJson[x].peers[y].responses["4xx"]),
				JSON.stringify(objectJson[x].peers[y].responses["5xx"]),
				JSON.stringify(parseInt(objectJson[x].peers[y].sent/1024)) + 'kB',
				JSON.stringify(parseInt(objectJson[x].peers[y].received/1024)) + 'kB',
				JSON.stringify(objectJson[x].peers[y].health_checks.checks),
				JSON.stringify(objectJson[x].peers[y].health_checks.fails),
				JSON.stringify(objectJson[x].peers[y].health_checks.unhealthy)
				);
			data[data.length] = linearr;
		}
	}
	table.setData(data);
}

function loadStatus() {
	screen.title = "NGINX Plus: " + statusURL;
	http.get({
		host: url.parse(statusURL).hostname,
		port: url.parse(statusURL).port,
		path: url.parse(statusURL).path,
		}, function(response) {
			var body = '';
			response.on('data', function(d) {
				body += d;
			});
			response.on('end', function() {
				try {
					jsondata = JSON.parse(body);
				} catch(e) {
					screen.destroy();
					console.log("No JSON output found at " + statusURL + ", exiting.");
					process.exit(1);
				}
				if (jsondata.version != 6 && !jsondata.nginx_version) {
					screen.destroy();
					console.log("NGINX Plus API version mismatch or other errors");
					process.exit(1);
				}
				if(olddata.length == 0) {
					olddata = jsondata;
				}
				jsondata.connections.acceptedDelta = (jsondata.connections.accepted - olddata.connections.accepted) * 1000 / refreshRate;
				jsondata.requests.totalDelta = (jsondata.requests.total - olddata.requests.total) * 1000 / refreshRate;
				olddata = jsondata;
				drawScreen();
			});
		});
	return 0;
};

function prepareList(objectJson){
	var arr = {};
	arr.data = [];
	for(var x in objectJson){
		objectJson[x].name=x;
		arr.data.push(objectJson[x]);
	}
	return arr;
}

function drawScreen() {
	var contentBody;
	switch(tabview) {
		case 1:
			jsondata.tabview = 1;
			contentBody = Mark.up(templateMain, jsondata);
			var content = Mark.up(templateTitle,jsondata) + contentBody;
			box.setContent(content);
			table.hide();
			screen.render();
			break;
		case 2:
			jsondata.tabview = 2;
			var contentJson = prepareList(jsondata.server_zones);
			contentBody = Mark.up(templateHttpZones, contentJson);
			var content = Mark.up(templateTitle,jsondata) + contentBody;
			table.hide();
			box.setContent(content);
			screen.render();
			break;
		case 3:
			jsondata.tabview = 3;
			var contentBody = '';
			if (simpleView) {
				table.hide();
				var contentJson = prepareList(jsondata.upstreams);
				contentBody = Mark.up(templateHttpUpstreams, contentJson);
			} else {
				generateUpstreamTable(jsondata.upstreams);
				table.show();
			}
			var content = Mark.up(templateTitle,jsondata) + contentBody;
			box.setContent(content);
			screen.render();
			break;
		case 4:
			jsondata.tabview = 4;
			var contentJson = prepareList(jsondata.stream.server_zones);
			contentBody = Mark.up(templateStreamZones, contentJson);
			var content = Mark.up(templateTitle,jsondata) + contentBody;
			table.hide();
			box.setContent(content);
			screen.render();
			break;
		case 5:
			jsondata.tabview = 5;
			var contentJson = prepareList(jsondata.stream.upstreams);
			contentBody = Mark.up(templateStreamUpstreams, contentJson);
			var content = Mark.up(templateTitle,jsondata) + contentBody;
			table.hide();
			box.setContent(content);
			screen.render();
			break;
		case 6:
			break;
		case 7:
			break;

	}
}

loadScreen();
loadStatus();
setInterval(loadStatus,refreshRate);
