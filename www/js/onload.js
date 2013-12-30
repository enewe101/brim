var rtc_connection;
var get_user_media_handler = {
	'constraints': mediaConstraints,
	'on_success': add_streams_then_open,
	'on_error': onUserMediaError
}


function init() {

	// Build rtc_connection and initialize
	rtc_connection = new RTCConnectionObj();
	rtc_connection.init();
	
	// Request to get the camera and microphone
	try {
		doGetUserMedia(get_user_media_handler);
	} catch(e) {
		alert('get user media failed: ' + e);
	}

	// CALL MAYBE START HERE.  RENAME TO SEND_CHANNEL_REQUEST
	// if not first to arrive, send open channel request


	// Initialize the whiteboard
	init_whiteboard();
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
	append_message('local request to access media')
}


function onUserMediaError() {
	alert_str = "Couldn't get your webcam and microphone.  Did you forget to";
	alert_str += " allow access? Are you using Chrome or Firefox?";
	alert(alert_str);
}


function add_streams_then_open(stream) {
	rtc_connection.add_video_channel(stream);

	var handler = {
		'onopen': handleSendChannelOpen,
		'onclose': handleSendChannelClose
	};
	rtc_connection.add_data_channel('whiteboard_channel', handler)
	
	// TODO: build a method in rtc_connection to expect receive channels, and 
	// the method should allow you to put onReceive handlers for what to do 
	// when the channels are received

	attachMediaStream(localVideo, stream);
	localVideo.style.opacity = 1;
	localStream = stream;

	// If you are not the first to arrive, then attempt to open an RTC 
	// connection
	if(!is_first) {
		rtc_connection.request_connection();
	}
}

function handleSendChannelClose() {
	alert('closed channel');
	append_message('Send channel state is: ' + readyState);
	dataChannelSend.disabled = true;
}

function handleSendChannelOpen() {
	var readyState = this.readyState;
	append_message('Send channel state is: ' + readyState);

	dataChannelSend.disabled = false;
	dataChannelSend.focus();
	dataChannelSend.value = "";

	sendButton.onclick = arm_send_button(this);
	closeButton.onclick = closeDataChannels;
}

function arm_send_button(o) {
	return function send_text_and_clear() {
		append_message('Sending data: ' + data);
		var data = dataChannelSend.value;

		// this should be a method provided by rtc_connection
		o.send(data);

		dataChannelSend.value = '';
		append_message('Sent data: ' + data + '!!');
	};
}


function closeDataChannels() {
	rtc_connection.close_connection();
	dataChannelSend.value = "";
	dataChannelReceive.value = "";
	dataChannelSend.disabled = true;
	alert('data channels closed!');
}
