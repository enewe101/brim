var rtc_connection;

function init() {
	rtc_connection = new RTCConnectionObj();
	rtc_connection.init();

	//REPLANT HERE
	try {
		_doGetUserMedia();
	} catch(e) {
		alert(e);
	}
	init_whiteboard();
}


var _doGetUserMedia = function (o) {
	return function() {
		// Call into getUserMedia via the polyfill (adapter.js).
		try {
			getUserMedia(mediaConstraints, onUserMediaSuccess, onUserMediaError);
			append_message('local request to access media')
		} catch (e) {
			append_message('getUserMedia failed with exception: ' + e.message);
		}
	};
}(rtc_connection);

function onUserMediaError() {
	alert('userMediaFalied');
}

function onUserMediaSuccess(stream) {
		alert('got user media');

		// REENTERING
		rtc_connection.attatch_channel(stream);

		// REENTER HERE
		// re-enter connection object file here
//		attachMediaStream(localVideo, stream);
//		localVideo.style.opacity = 1;
//		localStream = stream;
//		// Caller creates PeerConnection.
//		o.maybeStart();
}

