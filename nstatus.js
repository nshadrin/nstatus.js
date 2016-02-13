#!/usr/bin/env nodejs

console.log('Loading ...');
var blessed = require('blessed');
var nstatus = require('http');
var process = require('process');
var http = require('http');
var url = require('url');
var fs = require("fs");

var Mark = require("markup-js");
var templateMain =		fs.readFileSync("templates/main.txt", "utf8");
var templateTitle =		fs.readFileSync("templates/title.txt", "utf8");
var templateHttpZones =		fs.readFileSync("templates/http_zones.txt", "utf8");
var templateHttpUpstreams =	fs.readFileSync("templates/http_upstreams.txt", "utf8");
var templateStreamZones =	fs.readFileSync("templates/stream_zones.txt", "utf8");
var templateStreamUpstreams =	fs.readFileSync("templates/stream_upstreams.txt", "utf8");

var tabview = 0;
var olddata = '';
var jsondata = '';


function loadScreen() {
	screen = blessed.screen({
		smartCSR: true
	});

	screen.title = 'NGINX Plus Dashboard';

	box = blessed.box({
		width: '100%',
		height: '100%',
		scrollable: true,
		scrollbar: true,
		alwaysScroll: true,
		top: '0',
		tags: true,
		content: "\n\n{center}Waiting for dashboard data...{/center}",
		border: {
			type: 'line'
		},
		style: {
			fg: '#98FB98',
			bg: '#000000'
		}
	});

	screen.append(box);

	box.key('enter', function(ch, key) {
		loadStatus('');
	});

	screen.key(['q', 'C-c'], function(ch, key) {
		screen.destroy();
		console.log('Thanks for using nstatus.js. https://github.com/nshadrin/nstatus.js');
		return process.exit(0);
	});

	screen.key(['1'], function(ch, key) { tabview = 1; drawScreen(); });
	screen.key(['2'], function(ch, key) { tabview = 2; drawScreen(); });
	screen.key(['3'], function(ch, key) { tabview = 3; drawScreen(); });
	screen.key(['4'], function(ch, key) { tabview = 4; drawScreen(); });
	screen.key(['5'], function(ch, key) { tabview = 5; drawScreen(); });
	screen.key(['6'], function(ch, key) { tabview = 6; drawScreen(); });
	screen.key(['0','escape'], function(ch, key) { tabview = 0; drawScreen(); });
	
	screen.key(['down'], function(ch, key) { box.scroll(2); screen.render(); });
	screen.key(['up'], function(ch, key) { box.scroll(-2); screen.render(); });

	box.focus();
	screen.render();
}

function loadStatus(uri) {
	http.get({
		host: url.parse(process.argv[2]).hostname,
		path: '/status',
		//port: url.parse(process.argv[2]).port
		}, function(response) {
			var body = '';
			response.on('data', function(d) {
				body += d;
			});
			response.on('end', function() {
				jsondata = JSON.parse(body);
				if(olddata.length == 0) {
					olddata = jsondata;
				}
				jsondata.connections.acceptedDelta = jsondata.connections.accepted - olddata.connections.accepted;
				jsondata.requests.totalDelta = jsondata.requests.total - olddata.requests.total;
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
	//	screen.destroy();
		objectJson[x].name=x;
		arr.data.push(objectJson[x]);
	//	console.log("\n\n" + x + objectJson[x].requests);
	//	process.exit;
	}
	return arr;
}

function drawScreen() {
	var contentBody;
	switch(tabview) {
		case 0:
			jsondata.tabview = 0;
			contentBody = Mark.up(templateMain, jsondata);
			break;
		case 1:
			jsondata.tabview = 1;
			var contentJson = prepareList(jsondata.server_zones);
			contentBody = Mark.up(templateHttpZones, contentJson);
			break;
		case 2:
			jsondata.tabview = 2;
			var contentJson = prepareList(jsondata.upstreams);
			contentBody = Mark.up(templateHttpUpstreams, contentJson);
			break;
		case 3:
			jsondata.tabview = 3;
			var contentJson = prepareList(jsondata.stream.server_zones);
			contentBody = Mark.up(templateStreamZones, contentJson);
			break;
		case 4:
			jsondata.tabview = 4;
			var contentJson = prepareList(jsondata.stream.upstreams);
			contentBody = Mark.up(templateStreamUpstreams, contentJson);
			break;
		case 5:
			break;
		case 6:
			break;

	}
	var content = Mark.up(templateTitle,jsondata) + contentBody;
	box.setContent(content);
	screen.render();
}

loadScreen();
loadStatus('');
setInterval(loadStatus,1000);




