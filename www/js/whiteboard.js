
// DECLARE GLOBALS	
	toolz = {};

// Globalize some of the properties of the paper object so you
// don't have to keep writing paper.property all the time
paper.install(window);
curpath = null;

// INITIALIZE //
function Whiteboard(wrapper) {

	// ensure passed element is a jQuery
	this.wrapper = $(wrapper);

	this.init = function() {
		this.curpath = null;

		// make the canvas
		this.canvas = $('<canvas></canvas>');
		this.wrapper.append(this.canvas);
		this.canvas.css({
			'height': '600px',
			'width': '900px',
			'border':'solid 1px black'
		});

		// Build tools
		this.toolz = toolz;
		this.toolz['pencil'] = make_pencil();
		this.toolz['cloud'] = make_cloud();

		this.build_pallette();

		// .get() provides the underlying native dom element
		paper.setup(this.canvas.get(0));

		// Daw stuff to show connected
		var path = new paper.Path();
		path.strokeColor = 'black';
		var start = new paper.Point(100,100);
		path.moveTo(start);
		path.lineTo(start.add([200, -50]));
		paper.view.draw();

		// Activate pencil by default
		this.toolz['pencil'].activate();


		// Create connection to other whiteboad
		whiteboard_channel = getWhiteboardDataChannel();
	};

	this.build_pallette = function() {

		// make the pallette
		this.pallette_wrapper = $('<div></div>');
		this.wrapper.append(this.pallette_wrapper);
		this.pallette_buttons = {
			'pencil' : $('<div id="pencil">pencil</div>'),
			'cloud' : $('<div id="clouds">clouds</div>')
		};

		// append the buttons and arm them
		for(var key in this.pallette_buttons) {
			this.pallette_wrapper.append(this.pallette_buttons[key]);
			this.pallette_buttons[key].on(
				'click', function() {activate(key);} );
		}
	};

	this.init();
}

function getWhiteboardDataChannel() {
}

function activate(tool_name) {
	toolz[tool_name].activate();
}


function make_pencil() {
	var pencil = new Tool();

	// Set onmousedown
	pencil.onMouseDown = function(event) {
		console.log('registered mousedown');
		curpath = new Path();
		curpath.strokeColor = 'black';
		curpath.add(event.point);
	}

	pencil.onMouseDrag = function(event) {
		console.log('registered mouseDrag().');
		curpath.add(event.point);
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
		curpath = new Path();
		curpath.strokeColor = 'black';
		curpath.add(event.point);
	}

	pencil.onMouseDrag = function(event) {
		console.log('registered mouseDrag().');
		curpath.arcTo(event.point);
		paper.view.draw();
	}
	console.log('built pencil');

	return pencil;
}
