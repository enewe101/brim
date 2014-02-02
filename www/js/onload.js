/*    GLOBALS	 */

// connection objects
var rtc_connection;
var signaller;

// UI elements //
var localVideo;
var dataChannelSend;
var sendButton;
var closeButton;
var remoteVideo;

// settings and handlers
var get_user_media_handler = {
	'constraints': {"audio": true, "video": true},
	'on_success': add_streams_then_open,
	'on_error': onUserMediaError
}
receive_video_handler = {
	'onRemoteStreamAdded': onRemoteStreamAdded,
	'onVideoFlowing': onVideoFlowing
}
var send_data_handler = {
	'onopen': handleSendChannelOpen,
	'onclose': handleSendChannelClose
};
var receive_data_handler = {
	'onopen': function(){},
	'onclose': function(){},
	'onmessage': handleMessage
};
var send_aux_data = {
	'onopen': handleAuxChannelOpen,
	'onclose': handleSendChannelClose
};
var receive_aux_data = {
	'onopen': function(){},
	'onclose': function(){},
	'onmessage': function(e){alert(e.data);}
};

/*  end GLOBALS	 */


function init() {

	// registration of ui elements ==> move to application layer
	// where are these being used?
	var message_input = $('#message_input');
	var message_pane = $('#message_pane');
	localVideo = $('#local_video');
	remoteVideo = $('#remote_video');
	dataChannelSend = $('#dataChannelSend');
	dataChannelReceive = $('#dataChannelReceive');
	sendButton = $('#sendButton');
	closeButton = $('#closeButton');

	// Build signalling channel with messaging pane
	var message_box = [message_input, message_pane];
	var ids = [room_id, client_id];
	signaller = new Signaller(ids, message_box);


	// Build signalling channel without messaging pane
	//signaller = new Signaller(ids);

	// Build rtc_connection and initialize
	rtc_connection = new RTCConnectionObj(signaller);
	rtc_connection.init();

	// Request to get the camera and microphone
	try {
		doGetUserMedia(get_user_media_handler);
	} catch(e) {
		alert('get user media failed: ' + e);
	}

	// Initialize the whiteboard
	var wb = new Whiteboard($('#whiteboard_target').get(0));
}


// Get camera and microphone
var doGetUserMedia = function(handler) {

	// Check if the browser supports webRTC
	if(getUserMedia == null) {
		throw 'this browser does not support webRTC';
		return;
	} 

	// Get the microphone and camera now, and if successful, 
	// continue with building the channel...
	var h = handler;
	getUserMedia(h['constraints'], h['on_success'], h['on_error']);	
	signaller.append_message('local request to access media')
}


function onUserMediaError() {
	alert_str = "Couldn't get your webcam and microphone.  Did you forget to";
	alert_str += " allow access? Are you using Chrome or Firefox?";
	alert(alert_str);
}


function add_streams_then_open(stream) {
	// add video streams
	rtc_connection.add_video_channel(stream);
	rtc_connection.expect_video_channel(receive_video_handler);

	// add the whiteboard data channels
	rtc_connection.add_data_channel('whiteboard_channel', send_data_handler);
	rtc_connection.expect_data_channel(
		'whiteboard_channel', receive_data_handler);

	// add auxiliary data channel
	rtc_connection.add_data_channel('aux_channel', send_aux_data);
	rtc_connection.expect_data_channel('aux_channel', receive_aux_data);

	// feed the local video stream back into local video viewer
	attachMediaStream(localVideo.get(0), stream);
	localVideo.fadeIn("slow");

	// If you are not the first to arrive, then attempt to open an RTC 
	// connection
	rtc_connection.open();
	if(!is_first) {
		rtc_connection.doOffer();
	} else {
		rtc_connection.expectOffer();
	}
}

function handleSendChannelClose() {
	signaller.append_message('Send channel state is: ' + readyState);
	dataChannelSend.prop('disabled', true);
}

function handleSendChannelOpen() {
	var readyState = this.readyState;
	signaller.append_message('Send channel state is: ' + readyState);

	dataChannelSend.prop('disabled', false);
	dataChannelSend.focus();
	dataChannelSend.val("");

	sendButton.on('click', arm_send_button(this));
	closeButton.on('click', closeDataChannels);
}

function handleAuxChannelOpen() {
	$('#aux').on('click', arm_aux_button(this));
}

function handleMessage(event) {
  signaller.append_message('Received message: ' + event.data);
  dataChannelReceive.val(dataChannelReceive.val() + '\n' + event.data);
}

function arm_aux_button(o) {
	return function send_text_and_clear() {
		signaller.append_message('Sending data: ' + data);
		var data = dataChannelSend.val();

		// this should be a method provided by rtc_connection
		o.send(data);

		dataChannelSend.val('');
		signaller.append_message('Sent data: ' + data + '!!');
	};
}

function arm_send_button(o) {
	return function send_text_and_clear() {
		signaller.append_message('Sending data: ' + data);
		var data = dataChannelSend.val();

		// this should be a method provided by rtc_connection
		o.send(data);

		dataChannelSend.val('');
		signaller.append_message('Sent data: ' + data + '!!');
	};
}


function closeDataChannels() {
	rtc_connection.close_connection();
	dataChannelSend.val("");
	dataChannelReceive.val("");
	dataChannelSend.prop('disabled', true);
	alert('data channels closed!');
}
// Handlers for when remote video stream is added, and video starts flowing
function onRemoteStreamAdded(event) {
	attachMediaStream(remoteVideo.get(0), event.stream);
}

function onVideoFlowing() {
	remoteVideo.fadeIn("slow");
	setTimeout(function() { miniVideo.style.opacity = 1; }, 1000);
}

