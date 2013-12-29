var rtc_connection;

function init() {
	var debug = true;
	if(debug) {
		try {
			rtc_connection = init_webrtc();
			init_whiteboard();
		} catch(e) {
			alert(e);
		}
	} else {
		init_webrtc();
		init_whiteboard();
	}

}

