var rtc_connection;
var get_user_media_handler = {
	'constraints': mediaConstraints,
	'on_success': add_video_stream,
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

function add_video_stream(stream) {
	rtc_connection.attatch_channel('video', stream);
}

