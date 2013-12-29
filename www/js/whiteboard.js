
// DECLARE GLOBALS	
	toolz = {};

// Globalize some of the properties of the paper object so you
// don't have to keep writing paper.property all the time
paper.install(window);
curpath = null

// INITIALIZE //
function init_whiteboard() {

	// Get the canvas and bind it to paper.js
	var canvas = $('whiteboard');
	paper.setup(canvas);

	// Daw stuff to show connected
	var path = new paper.Path();
	path.strokeColor = 'black';
	var start = new paper.Point(100,100);
	path.moveTo(start);
	path.lineTo(start.add([200, -50]));
	paper.view.draw();

	// Build tools
	toolz['pencil_tool'] = make_pencil();
	toolz['cloud_tool'] = make_cloud();

	// Activate pencil by default
	toolz['pencil_tool'].activate();

	// Activate the toolPallet
	var pencil_button = $('pencil_button');
	pencil_button.onclick = acivate_pencil;

	var cloud_button = $('cloud_button');
	cloud_button.onclick = acivate_cloud;

	// Create connection to other whiteboad
	whiteboard_channel = getWhiteboardDataChannel()
}

function getWhiteboardDataChannel() {
}

function  acivate_pencil() {
	toolz['pencil_tool'].activate();
}

function  acivate_cloud() {
	toolz['cloud_tool'].activate();
}

function make_pencil() {
	var pencil = new Tool();

	// Set onmousedown
	pencil.onMouseDown = function(event) {
		console.log('registered mousedown');
		currpath = new Path();
		currpath.strokeColor = 'black';
		currpath.add(event.point);
	}

	pencil.onMouseDrag = function(event) {
		console.log('registered mouseDrag().');
		currpath.add(event.point);
		paper.view.draw();
	}
	console.log('built pencil');

	return pencil;
}

function make_cloud() {
	var pencil = new Tool();

	// Set onmousedown
	pencil.onMouseDown = function(event) {
		console.log('registered mousedown');
		currpath = new Path();
		currpath.strokeColor = 'black';
		currpath.add(event.point);
	}

	pencil.onMouseDrag = function(event) {
		console.log('registered mouseDrag().');
		currpath.arcTo(event.point);
		paper.view.draw();
	}
	console.log('built pencil');

	return pencil;
}
