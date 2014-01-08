//
// Signaller provides a signalling channel that allows two clients to
// exchange messages.
// It is designed to fulfill the folowing interface:
//
//		open(onmessage_callback);
// 		send_message(msg)
//
// Messages sent by a client will be recieved by all other clients that 
// have navigated to the same room_id.  Details about how the room is 
// assigned to the signaller and how they are managed are not part of this
// interface.
//
// At the moment, the room_id and client_id are stored in global javascript
// variables set in the index.php page by the server.
//
// Polling works as follows: when open() is called, the signaller starts 
// polling the server using AJAX at http://shpow.com/php/poll.php on a regular 
// basis (default 2 sec.).  It requests entries from the signalling table that 
// match the room_id and have a client_id not equal to the client's own id.
// The reply is a list of messages by the server recieved from other clients
// in the same room later than or equal to the timestamp of the last received
// message (sent as part of the query).  Allowing equality is to be sure that
// no messages are missed, and this means that in general there will be a
// duplicate message that gets filtered.
//
// The signaller then calls the onmessage_callback function that was passed to
// it in the constructor.
//


function Signaller(ids, message_box) {
	this.room_id = ids[0];
	this.client_id = ids[1];
	this.onmessage = false;
	this.last_signal_id = null;
	this.last_msg_timestamp = '0';

	if(message_box) {
		this.message_input = message_box[0];
		this.message_pane = message_box[1];
	} else {
		this.message_input = false;
		this.message_pane = false;
	}
	// TODO: an initial join call maybe should be sent in order to get the
	// mysql server time at joining.  This would be used to initialize 
	// last_msg_timestamp to a val other than '0', so that the client doesn't
	// get all messages sent in the room before she arrived.
	//
	// at the moment, a join room signal is beign sent by the index.php script
	// which should probably be moved to the end of the this.open execution.
	// Joining the room really should mean that you are ready to 
	// receive signals addressed to the room.
	this.open = function(callback, milli_interval) {
		this.onmessage = callback;
		milli_interval = milli_interval || 2000;
		setInterval(this.poll, milli_interval);
	}


	this.poll = function(o) {
		return function(type) {
			// 'type' allows you to poll selectively for messages having a 
			// given type set in the type field.  It's optional and not 
			// actually used anywhere right now.
			type = type || '';

			var parameters = {
				'room_id': o.room_id,
				'client_id':  o.client_id,
				'type': type,
				'last_msg_timestamp':  o.last_msg_timestamp
			};

			new Ajax.Request('php/poll.php', {
				'method': 'post',
				'parameters': parameters,
				'onSuccess':  o.message_handler,
				'onFailure': function(transport) {
					alert('failure!');
				}
			});
		};
	}(this);


	this.message_handler = function(o) {
		return function(response) {
			var messages = eval(response.responseText);
			messages = messages.filter(o.is_new_signal);

			for(var i=0; i<messages.length; i++) { 
				// signalling object
				this.last_signal_id = messages[i]['signal_id'];
				o.last_msg_timestamp = messages[i]['timestamp'];
				var msg = messages[i]['message'];

				// message type 'message' is used for manually sending text
				// accross the signalling channel.  Users of the signaller
				// won't see it, but it's useful to test and make sure the
				// signaller is working
				if(messages[i].type == 'message') {
					var text_msg = "<span class='blue'><span class='bold'>";
					text_msg += "Other: </span>" + msg + "</span>";
					o.append_message(text_msg);

				// all other messages get passed to the callback function
				} else {
					o.onmessage(messages[i]);
				}
			}
		};
	}(this);


	this.emit = function(msg) {
		var text_msg = "<span class='green'><span class='bold'>You: </span>";
		text_msg +=	msg + "<\span>"
		this.append_message(text_msg)
		this.send_message('message', msg);
	}


	this.is_new_signal = function(val) {
		if(this.last_signal_id === null){
			return true;
		} else if(val['signal_id'] > this.last_signal_id) {
			return true;
		}
		
		return false;
	}


	this.send_message = function(type, msg) {
		var parameters = {
			'room_id': this.room_id,
			'client_id': this.client_id,
			'type':type, 
			'message': msg
		};

		new Ajax.Request('php/post.php', {
			'method': 'post',
			'parameters': parameters,
			'onSuccess': function(transport) {
			},
			'onFailure': function(transport) {
				alert('failure!');
			}
		});
	};


	this.check_key = function(o) {
		return function(e) {
			var evtobj=window.event? event : e;
			var unicode=evtobj.charCode? evtobj.charCode : evtobj.keyCode;
			if (unicode==13) {
				o.emit(this.value);
				this.value = '';
			}
		}	
	}(this);


	// only enable manual text messaging if we have a text input!
	if(this.message_input) {
		this.message_input.onkeydown = this.check_key;
	}


	// only enable append_message if we have a message pane!
	this.append_message = function(msg) {};
	if(this.message_pane) {
		this.append_message = function(msg) {
			var message = new Element('div');
			message.update(msg);
			this.message_pane.insert({'bottom':message});
		}
	} 
}


