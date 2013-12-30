var rtc_connection;

function init() {
	try {
		var rtc_connection = new RTCConnectionObj();
		rtc_connection.init();
	} catch(e) {
		alert(e);
	}
//	init_webrtc();
	init_whiteboard();
}

