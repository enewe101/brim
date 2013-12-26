function check_key(e) {
	var evtobj=window.event? event : e;
	var unicode=evtobj.charCode? evtobj.charCode : evtobj.keyCode;
	if (unicode==13) {
		emit(this.value);
		this.value = '';
	}
}	


function begin_polling(millisecond_interval, success_callback) {
	setInterval(doPoll(success_callback), millisecond_interval);
}


function emit(msg) {
	append_message("<span class='green'><span class='bold'>You: </span>" + msg + "<\span>")
	send_message(room_id, client_id, 'message', msg);
}


function doPoll(success_callback) {
	return function() {
		poll(room_id, client_id, null, last_msg_timestamp, success_callback);
	};
}


function poll(room_id, client_id, type, last_msg_timestamp, success_callback) {
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
		'onSuccess': function(transport) {
			success_callback(transport.responseText);
		},
		'onFailure': function(transport) {
			alert('failure!');
		}
	});
}


function is_new_signal(val) {
	if(last_signal_id === null){
		return true;
	} else if(val['signal_id'] > last_signal_id) {
		return true;
	}
	
	return false;
}


function send_message(room_id, client_id, type, msg) {
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
}
