#!/usr/bin/env nodejs

console.log('Loading ...');
var blessed = require('blessed');
var nstatus = require('http');
var validUrl = require('valid-url');
var process = require('process');
var http = require('http');
var fs = require("fs");
var Mark = require("markup-js");

var templateMain = fs.readFileSync("templates/main.txt", "utf8");
var templateHttpZones = fs.readFileSync("templates/http_zones.txt", "utf8");
var templateHttpUpstreams = fs.readFileSync("templates/http_upstreams.txt", "utf8");


var tabview = 0;
var olddata = '';
var jsondata = '';

if (validUrl.isUri(process.argv[2])){
} else {
	console.log('Bad status URL format: ' + process.argv[2]);
	process.exit(2);
}


// Create a screen object.
var screen = blessed.screen({
	smartCSR: true
});

screen.title = 'NGINX Plus Dashboard';

// Create a box perfectly centered horizontally and vertically.

var title = "{center}NGINX Plus Live Activity Monitoring{/center}\n\n";


var box = blessed.box({
	width: '100%',
	height: '100%',
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

// Append our box to the screen.

// If box is focused, handle `enter`/`return` and give us some more content.
box.key('enter', function(ch, key) {
	loadStatus('');
});

// Quit on Escape, q, or Control-C.
screen.key(['q', 'C-c'], function(ch, key) {
	return process.exit(0);
});

screen.key(['escape'], function(ch, key) {
	tabview = 0;
	drawScreen();
});

screen.key(['1'], function(ch, key) { tabview = 1; drawScreen(); });
screen.key(['2'], function(ch, key) { tabview = 2; drawScreen(); });
screen.key(['3'], function(ch, key) { tabview = 3; drawScreen(); });
screen.key(['4'], function(ch, key) { tabview = 4; drawScreen(); });
screen.key(['5'], function(ch, key) { tabview = 5; drawScreen(); });
screen.key(['6'], function(ch, key) { tabview = 6; drawScreen(); });
screen.key(['0'], function(ch, key) { tabview = 0; drawScreen(); });

// Focus our element.
box.focus();

// Render the screen.
screen.render();

function loadStatus(uri) {
	http.get({
		host: 'demo.nginx.com',
		path: '/status'
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


function drawScreen() {
	var mytemplate;
	switch(tabview) {
		case 0:
			mytemplate = Mark.up(templateMain, jsondata);
			break;
		case 1:
			mytemplate = Mark.up(templateHttpZones, jsondata);
			break;
		case 2:
			mytemplate = Mark.up(templateHttpUpstreams, jsondata);
			break;
	}
	var content = title + mytemplate;
	box.setContent(content);
	screen.render();
}


loadStatus('');
setInterval(loadStatus,1000);




