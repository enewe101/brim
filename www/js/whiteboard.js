
// DECLARE GLOBALS	

// Globalize some of the properties of the paper object so you
// don't have to keep writing paper.property all the time
paper.install(window);
curpath = null;

// INITIALIZE //
function Whiteboard(wrapper, self_id) {

	// ensure passed element is a jQuery

	this.init = function() {

		// # INSTANCE VARIABLES  # //

		this.wrapper = $(wrapper);
		this.self_id = self_id;
		this.send_channels = [];
		this.paths = {};
			// stores all paths in history uniquely:
			//
			// this.paths = {
			// 		<user-hash + path-#> : <path_obj>,
			// 		<user-hash + path-#> : <path_obj>,
			// 		...,
			// 		<self-hash + path-#> : <path_obj>
			// 	}

		this.curpaths = {};
		this.curpaths[self_id] = null;
			// curpaths stores pointers to the currently active paths for all 
			// peers, including self:
			//
			// 	this.curpaths = {
			// 		<user-hash>: <curpath-obj>,
			// 		<other-user-hash>: <other-curpath-obj>,
			//	 	...,
			// 		'self': <curpath-obj>
			// 	}

		this.path_increment;
			// Helps assign incrementing id#s to new local paths

		// make the canvas
		this.canvas = $('<canvas></canvas>');
		this.wrapper.append(this.canvas);
		this.canvas.css({
			'height': '600px',
			'width': '900px',
			'border':'solid 1px black'
		});

		// Build tools
		this.toolz = {}
		this.toolz['pencil'] = this.make_pencil();
		this.toolz['cloud'] = this.make_cloud();
		this.toolz['eraser'] = this.make_eraser(); /**/

		this.build_pallette();

		// Setup the canvas
		// .get() provides the underlying native dom element
		paper.setup(this.canvas.get(0));

		// Daw stuff to show connected
		this.test_draw();

		// Activate pencil by default
		this.toolz['pencil'].activate();


		// Create connection to other whiteboad
		whiteboard_channel = getWhiteboardDataChannel();
	};

	this.path_inc = function() {
		this.path_increment += 1;
		return this.path_increment - 1;
	}
	
	this.add_receive_channel = function(user_hash, e) {
		// make a slot for the new user's paths
		// should use user_hash as the key, but this is not being sent
		// properly
		this.paths['other'] = [];
		alert('receiving from ' + user_hash);
	};

	this.set_send_channel = function(channel) {
		this.send_channels.push(channel);
	};

	this.handle_message = function(sender, msg_text) {
		msg = eval('(' + msg_text + ')');

		var path_id = msg['path_id'];

		// First get the path object to be manipulated
		// This may involve creating a new path
		if('action' in msg && msg['action'] == 'create') {
			var path = new paper.Path();
			this.paths['other'][path_id] = path;
			this.curpaths['other'] = path;
		} else {
			var path = this.paths['other'][path_id];
		}

		// look for path property changes

		for(var key in msg) {
			if(['strokeColor', 'blendMode', 'strokeWidth', 'strokeCap', 'strokeJoin'].indexOf(key) >= -1) {
				path[key] = msg[key];
			}
		}

		// fulfill move and draw actions last
		if ('action' in msg && msg['action'] != 'create') {
			var path = this.paths['other'][path_id];
			var coords = msg['point'];
			var point = new paper.Point(coords[0], coords[1]);
			path[msg['action']](point);
			paper.view.draw();
		} 


	};

	this.test_draw = function() {
		var path = new paper.Path();
		path.strokeColor = 'black';
		var start = new paper.Point(100,100);
		path.moveTo(start);
		path.lineTo(start.add([200, -50]));
		paper.view.draw();
	};

	this.build_pallette = function() {

		// make the pallette
		this.pallette_wrapper = $('<div></div>');
		this.wrapper.append(this.pallette_wrapper);
		this.pallette_buttons = {
			'pencil' : $('<div id="pencil">pencil</div>'),
			'cloud' : $('<div id="clouds">clouds</div>'),
			'eraser' : $('<div id="eraser">eraser</div>')
		};

		// append the buttons and arm them
		for(var key in this.pallette_buttons) {
			this.pallette_wrapper.append(this.pallette_buttons[key]);
			this.pallette_buttons[key].on(
				'click', $.proxy(this, "activate", key));
		}
	};

	this.activate = function(tool_name) {
		this.toolz[tool_name].activate();
	};

	this.broadcast = function(msg) {
		for(var i=0; i<this.send_channels.length; i++) {
			this.send_channels[i].send(JSON.stringify(msg));
		}
	}

	this.make_eraser = function() {
		var pencil = new Tool();

		// Set onmousedown
		pencil.onMouseDown = function(o) {
			return function(event) {
				var curpath = new Path();
				o.curpaths[o.self_id] = curpath;
				curpath.strokeColor = 'black';
				curpath.blendMode = 'destination-out';
				curpath.strokeWidth = '30';
				curpath.strokeCap = 'round';
				curpath.strokeJoin = 'round';

				o.broadcast({
					'action':"create",
					'strokeColor':'black',
					'strokeWidth': '30',
					'strokeCap': 'round',
					'strokeJoin': 'round',
					'blendMode': 'destination-out'
				});

				curpath.add(event.point);
				curpath.lineTo(event.point);
				paper.view.draw();

				o.broadcast({
					'action':"moveTo",
					"point":[event.point['x'],event.point['y']]
				});
			};
		}(this);

		pencil.onMouseDrag = function(o) {
			return function(event) {
				var curpath = o.curpaths[o.self_id];
				curpath.add(event.point);
				paper.view.draw();

				o.broadcast({
					'action':"lineTo",
					"point":[event.point['x'],event.point['y']]
				});
			};
		}(this);

		console.log('built pencil');
		return pencil;
	};


	this.make_pencil = function() {
		var pencil = new Tool();

		// Set onmousedown
		pencil.onMouseDown = function(o) {
			return function(event) {
				var curpath = new Path();
				o.curpaths[o.self_id] = curpath;
				curpath.strokeColor = 'black';
				curpath.strokeWidth = '30';
				curpath.strokeCap = 'round';
				curpath.strokeJoin = 'round';

				o.broadcast({
					'action':"create",
					'strokeColor':'black',
					'strokeWidth': '30',
					'strokeCap': 'round',
					'strokeJoin': 'round',
				});


				curpath.add(event.point);
				curpath.lineTo(event.point);
				paper.view.draw();

				o.broadcast({
					'action':"moveTo",
					"point":[event.point['x'],event.point['y']]
				});
			};
		}(this);

		pencil.onMouseDrag = function(o) {
			return function(event) {
				var curpath = o.curpaths[o.self_id];
				curpath.add(event.point);
				paper.view.draw();

				o.broadcast({
					'action':"lineTo",
					"point":[event.point['x'],event.point['y']]
				});
			};
		}(this);

		console.log('built pencil');
		return pencil;
	};

	this.make_cloud = function() {
		var pencil = new Tool();

		// Set onmousedown
		pencil.onMouseDown = function(o) {
			return function(event) {
				var curpath = new Path();
				o.curpaths[o.self_id] = curpath;
				curpath.strokeColor = 'black';

				o.broadcast({
					'action':"create",
					"strokeColor":'black'
				});

				curpath.add(event.point);

				o.broadcast({
					'action':"moveTo",
					"point":[event.point['x'],event.point['y']]
				});
			};
		}(this);

		pencil.onMouseDrag = function(o) {
			return function(event) {
				var curpath = o.curpaths[o.self_id];
				curpath.arcTo(event.point);
				paper.view.draw();

				o.broadcast({
					'action':"arcTo",
					"point":[event.point['x'],event.point['y']]
				});
			};
		}(this);

		console.log('built pencil');
		return pencil;
	};

	this.init();
}

function getWhiteboardDataChannel() {
}




