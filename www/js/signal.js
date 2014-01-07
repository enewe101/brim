

function Signaller(message_input, message_pane) {
	this.onmessage = false;
	this.message_input = message_input;
	this.message_pane = message_pane;
	this.open = function(callback, milli_interval) {
		this.onmessage = callback;
		milli_interval = milli_interval || 2000;
		setInterval(this.doPoll, milli_interval);
	}

	this.message_input.onkeydown = this.check_key;

	this.doPoll = function(o){
		return function() {
			o.poll(room_id, client_id, null, last_msg_timestamp, o.onmessage);
		};
	}(this);


	this.poll = function(room_id, client_id, type, last_msg_timestamp, success_callback) {
		type = type || '';

		parameters = {
			'room_id':room_id,
			'client_id': client_id,
			'type': type,
			'last_msg_timestamp': last_msg_timestamp
		};

		new Ajax.Request('php/poll.php', {
			'method': 'post',
			'parameters': parameters,
			'onSuccess': this.message_handler,
			'onFailure': function(transport) {
				alert('failure!');
			}
		});
	}

	this.message_handler = function(o) {
		return function(response) {
			messages = eval(response.responseText);
			messages = messages.filter(o.is_new_signal);

			for(var i=0; i<messages.length; i++) { 
				// make last_signal_id and last_msg_timestamp instance variables of the
				// signalling object
				last_signal_id = messages[i]['signal_id'];
				last_msg_timestamp = messages[i]['timestamp'];
				msg = messages[i]['message'];

				//message type 'message' is used for plain text -- always let them through
				if(messages[i].type == 'message') {
					o.append_message("<span class='blue'><span class='bold'>Other: </span>" + msg + "</span>");
				}

				// for other message types, enque if you are not ready
				o.onmessage(messages[i]);
			}
		};
	}(this);

	this.emit = function(msg) {
		this.append_message("<span class='green'><span class='bold'>You: </span>" + msg + "<\span>")
		this.send_message(room_id, client_id, 'message', msg);
	}

	this.is_new_signal = function(val) {
		if(last_signal_id === null){
			return true;
		} else if(val['signal_id'] > last_signal_id) {
			return true;
		}
		
		return false;
	}

	this.send_message = function(room_id, client_id, type, msg) {
		parameters = {
			'room_id':room_id,
			'client_id': client_id,
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

	this.check_key = function(e) {
		var evtobj=window.event? event : e;
		var unicode=evtobj.charCode? evtobj.charCode : evtobj.keyCode;
		if (unicode==13) {
			signaller.emit(this.value);
			this.value = '';
		}
	}	

	this.append_message = function(msg) {
		message = new Element('div');
		message.update(msg);
		this.message_pane.insert({'bottom':message});
	}

}


