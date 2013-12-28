function init() {
	var debug = true;
	if(debug) {
		try {
			init_webrtc();
			init_whiteboard();
		} catch(e) {
			alert(e);
		}
	} else {
		init_webrtc();
		init_whiteboard();
	}
}

