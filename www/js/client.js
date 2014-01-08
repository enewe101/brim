	// * //
	// * // This code provides a webRTC connection service to the script
	// * // has joined the room
	// * // Also, doCall should maybeFire as soon as a new person has joined or
	// * // anything needed
	// * //	for it to preceed is added.  THings needed for it to proceed
	// * // 	- local stream
	// * //


// TODO: there are two functions to close the pc.  There should only be one.
// TODO: hook up the message sendinp function to the button.
// TODO: make the signalling object its own object, probably give 
// 	processSignalingMessage as the message handling callback


// GLOBALS //
// * UI elements //
var localVideo;
var localStream;
var dataChannelSend;
var sendButton;
var closeButton;

// * Streams and Channels //
var remoteVideo;
var remoteStream;
var receiveChannel;

// * The Peer Connection object //
var pc = null;

// * Connection settings and state //
var stereo = false;
var audio_send_codec = '';
var offerConstraints = {"optional": [], "mandatory": {}};
var mediaConstraints = {"audio": true, "video": true};
var audio_receive_codec = 'opus/48000';
var gatheredIceCandidateTypes = { Local: {}, Remote: {} };
var isVideoMuted = false;
var isAudioMuted = false;
var sdpConstraints = {
	'mandatory': {
		'OfferToReceiveAudio': true,
		'OfferToReceiveVideo': true 
	}
};
var pcConfig = {
	"iceServers": [
		{"url": "stun:stun.services.mozilla.com"}
	]
};
var pcConstraints = {
	"optional": [
		{"DtlsSrtpKeyAgreement": true},
		{RtpDataChannels: true}
	]
};

// * Signalling state //
var msgQueue = [];
var signalling_ready = initiator;
var localStream = null;
var started = false;
var newPeerHere = false


window.onbeforeunload = function() {
	signaller.send_message('bye', "{'type':'bye'}");
}


function RTCConnectionObj(signaller) {
	this.signaller = signaller;
	this.do_expect_data_channel = false;
	this.do_expect_video_channel = false;
	// store the channels in the object scope
	// the channel obj structure is 
	// this.channels = { <type> : { <dir> : { <channel> : <attribute> }}}
	// 		Explanation:
	// 			type: 		(string) 'data' | 'video' 
	// 			dir: 		(string) 'send'|'receive'>
	// 			channel:	(string) e.g. 'whiteboard_channel', 'text_channel'
	//			attribute: 	(string) e.g. 'stream', 'onopen', 'onclose'
	this.channels = {
		'video': {'send':[], 'receive': null},
		'data': {'send':{}, 'receive':{}}
	}

	// TODO: user runs this right after construction: make it fire as part of 
	// construction?
	this.init = function() {
		// TODO: make this into a signalling object, 
		// separate signalling implementation from rtc_connection obj 
		signaller.open(this.message_handler);
	};


	this.onUserMediaError = function() {
		signaller.append_message('userMediaFalied');
	};


	// TODO: move this out to application.  It will help get the pollign
	// object ready part of this will probably go to the polling object code
	this.message_handler = function(o) {
		return function(parsed_message) {
			// for other message types, enque if you are not ready
			if(!initiator && !started) {
				if(parsed_message.type == 'offer') {
					msgQueue.unshift(parsed_message);
					signaller.append_message('received offer');
					signalling_ready = true
					o.request_connection();
				} else {
					msgQueue.push(parsed_message);
				}
			} else {
				o.processSignalingMessage(parsed_message);
			}
		}
	}(this);



	// This duplicates some functionality of this.onRemoteHangup
	this.close_connection = function() {
		alert('close data channels!');
		signaller.append_message('Closing data channels');

		for(chan in this.channels['data']['send']) {
			this.channels['data']['send'][chan]['stream'].close();
		}
	
		// this should be registered to this.channels dictionnary so that it
		// can be closed by iterating through open registered channels...
		for(chan in this.channels['data']['receive']) {
			this.channels['data']['receive'][chan]['stream'].close();
		}
		pc.close();
		pc = null;
	}


	// add channels to the connection before openning it
	// TODO: this throws an uncaught exception!
	this.add_data_channel = function(nickname, handler) {
		if(nickname in this.channels['data']['send']) {
			throw 'non-unique channel nickname given';
		}
		handler['stream'] = null;
		this.channels['data']['send'][nickname] = handler;
	};


	// Also add video channels -- you need to give it the stream
	this.add_video_channel = function(stream) {
		this.channels['video']['send'].push(stream);
	};

	this.expect_data_channel = function(nickname, handler) {
		this.do_expect_data_channel = true;
		this.channels['data']['receive'][nickname] = handler;
	};

	this.expect_video_channel = function(handler) {
		this.do_expect_video_channel = true;
		this.channels['video']['receive'] = handler;
	};

	// Request Peer connection
	this.openAndCall = function() {

		/*
		 *   PEER CONNECTION CREATED HERE
		 */
		console.log('Creating RTCPeerConnnection');
		try {
			// Create an RTCPeerConnection via the polyfill (adapter.js).
			pc = new RTCPeerConnection(pcConfig, pcConstraints);
			pc.onicecandidate = this.onIceCandidate; 
			console.log('Created RTCPeerConnnection');
		} catch (e) {
			console.log(
			'Failed to create PeerConnection, exception: ' + e.message);
			return;
		}

		if(this.do_expect_video_channel) {
			pc.onaddstream = this.onRemoteStreamAdded;
		}
		if(this.do_expect_data_channel) {
			pc.ondatachannel = this.gotReceiveChannel;
		}
		pc.onremovestream = this.onRemoteStreamRemoved;
		pc.onsignalingstatechange = this.onSignalingStateChanged;
		pc.oniceconnectionstatechange = this.onIceConnectionStateChanged;

		console.log('Adding local streams.');

		if(this.channels['video']['send'].length) {
			pc.addStream(this.channels['video']['send'][0]);
		}

		for(channel_label in this.channels['data']['send']) {
			var chan = pc.createDataChannel(
					channel_label, {reliable: false});

			// store the channel in this.channels
			var send_channels = this.channels['data']['send'];
			send_channels[channel_label]['stream'] = chan;

			// now add handlers from the handler object
			chan.onopen = send_channels[channel_label]['onopen'];
			chan.onclose = send_channels[channel_label]['onclose'];
		}

		started = true;
	};


	// Request Peer connection
	this.request_connection = function() {
		signaller.append_message('maybe start... ');

		if (!started && signalling_ready && localStream) {
			this.doAnser();
		} else {
			signaller.append_message("...didn't start");
		}
	};

	this.expectOffer = function() {
	};

	// Create and send a connection offer
	this.doOffer = function() {
		signaller.append_message('doCall');
		var constraints = this.mergeConstraints(
			offerConstraints, sdpConstraints);
		signaller.append_message(
			'Sending offer to peer, with constraints: \n' +
			'  \'' + JSON.stringify(constraints) + '\'.')
		pc.createOffer(
			this.setLocalAndSendMessage,
		   	this.onCreateSessionDescriptionError,
		   	constraints); // inside setLocal
	};


	// Create and send a connection reply
	this.doAnser = function() {
		// Callee starts to process cached offer and other messages.
		// the first message to process will be the answer, which is placed
		// at the head of the cue.  maybe better to give it a separate spot...
		while (msgQueue.length > 0) {
			this.processSignalingMessage(msgQueue.shift());
		}
	};

	// Produce an answer for RTC offer
	this.doAnswer = function() {
		try {
			pc.createAnswer(
				this.setLocalAndSendMessage,
			   	this.onCreateSessionDescriptionError,
			   	sdpConstraints);

		} catch(e) {
			signaller.append_message(e);
		}
	};


	// TODO: this should probably be the main callback given to the signalling 
	// object
	this.processSignalingMessage = function(message) {
		signaller.append_message('processing: ' + message);

		// TODO: I don't think this is needed because the joining peer 
		// initiates using a connection offer.  I think we don't need the join 
		// signal.
		//if(message.type == 'join') {
		//	alert('jain');
		//	signaller.append_message('newPeerHere = true');
		//	newPeerHere = true;
		//	this.request_connection();
		//}

		// It should not be possible to get this condition
		if (!started) {
			throw 'peerConnection has not been created yet!';
			return;
		}

		// Respond to offers
		if (message.type === 'offer') {
			signaller.append_message('...reading offer...');
			try {
				var offer = eval('(' + message['message'] + ')');
			} catch(e) {
				signaller.append_message('invalid message: ' + message['message']);
			}
			this.setRemote(offer);
			signaller.append_message('do answer now');
			this.doAnswer();

		// Respond to answers
		} else if (message.type === 'answer') {
			signaller.append_message('...reading answer...');
			try {
				var answer = eval('(' + message['message'] + ')');
			} catch(e) {
				signaller.append_message('invalid message: ' + message['message']);
			}
			this.setRemote(answer);

		// Respond to ice candidates
		} else if (message.type === 'candidate') {
			signaller.append_message('...reading candidate...');
			try {
				var answer = eval('(' + message['message'] + ')');
			} catch(e) {
				signaller.append_message('invalid message: ' + message['message']);
			}
			signaller.append_message('...candidate parsed...');
			var candidate = new RTCIceCandidate({sdpMLineIndex: message.label,
											 candidate: message.candidate});
			signaller.append_message('...candidate built...');
			this.noteIceCandidate("Remote", this.iceCandidateType(message.candidate));
			pc.addIceCandidate(candidate);

		// respond to hangup
		} else if (message.type === 'bye') {
			this.onRemoteHangup();
		}
	};


	// Handle hangup.  Does this duplicate functionality of close_connection?
	this.onRemoteHangup = function() {
	  signaller.append_message('Session terminated.');
	  initiator = 0;
	  this.stop();
	};

	this.stop = function() {
		started = false;
		signalling_ready = false;
		isAudioMuted = false;
		isVideoMuted = false;
		pc.close();
		pc = null;
		msgQueue.length = 0;
	};


	// helper to sort out ice candidate type
	this.iceCandidateType = function(candidateSDP) {
	  if (candidateSDP.indexOf("typ relay ") >= 0)
		return "TURN";
	  if (candidateSDP.indexOf("typ srflx ") >= 0)
		return "STUN";
	  if (candidateSDP.indexOf("typ host ") >= 0)
		return "HOST";
	  return "UNKNOWN";
	};


	// helper to keep track of ice candidates
	this.noteIceCandidate = function(location, type) {
	  if (gatheredIceCandidateTypes[location][type])
		return;
	  gatheredIceCandidateTypes[location][type] = 1;
	  signaller.append_message('candidate noted');
	};



	this.onCreateSessionDescriptionError = function(error) {
		signaller.append_message(
			'Failed to create session description: ' + error.toString());
	}

	this.setLocalAndSendMessage = function(o) {
		return function(sessionDescription) {
			// Resolve the session description
			sessionDescription.sdp = o.maybePreferAudioReceiveCodec(
					sessionDescription.sdp);

			// Set session description locally
			pc.setLocalDescription(
				sessionDescription,
				o.onSetSessionDescriptionSuccess,
			   	o.onSetSessionDescriptionError);

			// Send the offer | answer
			typ = initiator? 'offer' : 'answer';
			signaller.append_message('Sending ' + typ + ' to peer');
			o.signaller.send_message(typ, JSON.stringify(sessionDescription));
		};
	}(this);


	this.onSetSessionDescriptionError = function(error) {
	  signaller.append_message('Failed to set session description: ' + error.toString());
	}

	this.onSetSessionDescriptionSuccess = function() {
	  signaller.append_message('Set session description success.');
	}

	this.maybePreferAudioReceiveCodec = function(sdp) {
		if (audio_receive_codec == '') {
			signaller.append_message('No preference on audio receive codec.');
			return sdp;
		}
		signaller.append_message('Prefer audio receive codec: ' + audio_receive_codec);
		return this.preferAudioCodec(sdp, audio_receive_codec);
	}

	//// Set |codec| as the default audio codec if it's present.
	//// The format of |codec| is 'NAME/RATE', e.g. 'opus/48000'.
	this.preferAudioCodec = function(sdp, codec) {
	  var fields = codec.split('/');
	  if (fields.length != 2) {
		signaller.append_message('Invalid codec setting: ' + codec);
		return sdp;
	  }
	  var name = fields[0];
	  var rate = fields[1];
	  var sdpLines = sdp.split('\r\n');

	  // Search for m line.
	  for (var i = 0; i < sdpLines.length; i++) {
		  if (sdpLines[i].search('m=audio') !== -1) {
			var mLineIndex = i;
			break;
		  }
	  }
	  if (mLineIndex === null)
		return sdp;


	  // If the codec is available, set it as the default in m line.
	  for (var i = 0; i < sdpLines.length; i++) {
		if (sdpLines[i].search(name + '/' + rate) !== -1) {
		  var regexp = new RegExp(':(\\d+) ' + name + '\\/' + rate, 'i');
		  var payload = this.extractSdp(sdpLines[i], regexp);
		  if (payload)
			sdpLines[mLineIndex] = this.setDefaultCodec(sdpLines[mLineIndex],
												   payload);
		  break;
		}
	  }

	  // Remove CN in m line and sdp.
	  sdpLines = this.removeCN(sdpLines, mLineIndex);


	  sdp = sdpLines.join('\r\n');
	  return sdp;
	};

	this.setDefaultCodec = function(mLine, payload) {
	  var elements = mLine.split(' ');
	  var newLine = new Array();
	  var index = 0;
	  for (var i = 0; i < elements.length; i++) {
		if (index === 3) // Format of media starts from the fourth.
		  newLine[index++] = payload; // Put target payload to the first.
		if (elements[i] !== payload)
		  newLine[index++] = elements[i];
	  }
	  return newLine.join(' ');
	};

	this.removeCN = function(sdpLines, mLineIndex) {
	  var mLineElements = sdpLines[mLineIndex].split(' ');
	  // Scan from end for the convenience of removing an item.
	  for (var i = sdpLines.length-1; i >= 0; i--) {
		var payload = this.extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
		if (payload) {
		  var cnPos = mLineElements.indexOf(payload);
		  if (cnPos !== -1) {
			// Remove CN payload from m line.
			mLineElements.splice(cnPos, 1);
		  }
		  // Remove CN line in sdp
		  sdpLines.splice(i, 1);
		}
	  }

	  sdpLines[mLineIndex] = mLineElements.join(' ');
	  return sdpLines;
	};


	this.extractSdp = function(sdpLine, pattern) {
	  var result = sdpLine.match(pattern);
	  return (result && result.length == 2)? result[1]: null;
	};

	this.setRemote = function(message) {
		signaller.append_message('setting remote...');
	  // Set Opus in Stereo, if stereo enabled.
		if (stereo) {
			message.sdp = addStereo(message.sdp);
		}
		message.sdp = this.maybePreferAudioSendCodec(message.sdp);
		signaller.append_message('set preference');
		var sd = new RTCSessionDescription(message);
		signaller.append_message('made remote description obj');
		pc.setRemoteDescription(sd,
			this.onSetSessionDescriptionSuccess, this.onSetSessionDescriptionError);
		signaller.append_message('done setting remote');
	};


	// helper to merge two constraints objects
	this.mergeConstraints = function(cons1, cons2) {
	  var merged = cons1;
	  for (var name in cons2.mandatory) {
		merged.mandatory[name] = cons2.mandatory[name];
	  }
	  merged.optional.concat(cons2.optional);
	  return merged;
	}


	this.maybePreferAudioSendCodec = function(sdp) {
		signaller.append_message('setting preference');
	  if (audio_send_codec == '') {
		signaller.append_message('No preference on audio send codec.');
		return sdp;
	  }
	  signaller.append_message('Prefer audio send codec: ' + audio_send_codec);
	  return this.preferAudioCodec(sdp, audio_send_codec);
	}


	// Build the peer connection, which does most of the important actual 
	// data transfer and its negotiation
	this.makePeerConnection = function() {
		console.log('Creating RTCPeerConnnection');
		try {
			// Create an RTCPeerConnection via the polyfill (adapter.js).
			pc = new RTCPeerConnection(pcConfig, pcConstraints);
			pc.onicecandidate = this.onIceCandidate; 
			console.log('Created RTCPeerConnnection');
		} catch (e) {
			console.log(
			'Failed to create PeerConnection, exception: ' + e.message);
			return;
		}

		if(this.do_expect_video_channel) {
			pc.onaddstream = this.onRemoteStreamAdded;
		}
		if(this.do_expect_data_channel) {
			pc.ondatachannel = this.gotReceiveChannel;
		}
		pc.onremovestream = this.onRemoteStreamRemoved;
		pc.onsignalingstatechange = this.onSignalingStateChanged;
		pc.oniceconnectionstatechange = this.onIceConnectionStateChanged;
	};

	// Build the peer connection, which does most of the important actual 
	// data transfer and its negotiation
	this.createPeerConnection = function() {
		console.log('Creating RTCPeerConnnection');
		try {
			// Create an RTCPeerConnection via the polyfill (adapter.js).
			pc = new RTCPeerConnection(pcConfig, pcConstraints);
			pc.onicecandidate = this.onIceCandidate; 
			console.log('Created RTCPeerConnnection');
		} catch (e) {
			console.log(
			'Failed to create PeerConnection, exception: ' + e.message);
			return;
		}

		if(this.do_expect_video_channel) {
			pc.onaddstream = this.onRemoteStreamAdded;
		}
		if(this.do_expect_data_channel) {
			pc.ondatachannel = this.gotReceiveChannel;
		}
		pc.onremovestream = this.onRemoteStreamRemoved;
		pc.onsignalingstatechange = this.onSignalingStateChanged;
		pc.oniceconnectionstatechange = this.onIceConnectionStateChanged;
	};


	this.onIceConnectionStateChanged = function(event) {
	  signaller.append_message('onIceConnectionStateChanged');
	};

	this.onSignalingStateChanged = function(event) {
	  signaller.append_message('onSignalStateChange');
	};

	this.onRemoteStreamRemoved = function(event) {
	  signaller.append_message('Remote stream removed.');
	};


	this.gotReceiveChannel = function(o) {
		return function(event) {
			signaller.append_message('Receive Channel Callback');
			receiveChannel = event.channel;
			var chan = event.channel;

			var label = chan.label;
			var expected_data = o.channels['data']['receive'];

			if(expected_data[label]) {
				// implement by passing a handler from the application
				receiveChannel.onmessage = expected_data[label]['onmessage'];
				receiveChannel.onopen = expected_data[label]['onopen'];
				receiveChannel.onclose = expected_data[label]['onclose'];
				expected_data[label]['stream'] = chan;
			}
		};
	}(this);

	this.handleMessage = function(event) {
	  signaller.append_message('Received message: ' + event.data);
	  dataChannelReceive.value = dataChannelReceive.value + '\n' + event.data;
	};

	this.onRemoteStreamAdded = function(o) {
		return function(event) {
			console.log('Remote stream added.');

			remoteStream = event.stream;

			// Perform client onRemoteStreamAdded callback, if any
			var receive_callbacks = o.channels['video']['receive'];
			if(typeof receive_callbacks['onRemoteStreamAdded'] == 'function') {
				receive_callbacks['onRemoteStreamAdded'](event);
			}

			// Watch out for video to start comming down the stream
			o.waitForRemoteVideo();
		};
	}(this);

	this.waitForRemoteVideo = function() {
		signaller.append_message('waitForRemoteVideo');
		videoTracks = remoteStream.getVideoTracks();
		if (videoTracks.length === 0 || remoteVideo.currentTime > 0) {
			var receive_video_callbacks = this.channels['video']['receive'];
			if(typeof receive_video_callbacks['onVideoFlowing'] == 'function') {
				receive_video_callbacks['onVideoFlowing']();
			}
		} else {
			setTimeout(this.waitForRemoteVideo, 100);
		}
	};


	this.onIceCandidate = function(o) {
		return function(event) {
			if(event.candidate) {
				o.signaller.send_message('candidate', JSON.stringify({
					type: 'candidate',
					label: event.candidate.sdpMLineIndex,
					id: event.candidate.sdpMid,
					candidate: event.candidate.candidate}));
				o.noteIceCandidate("Local", o.iceCandidateType(event.candidate.candidate));
			} else {
			  signaller.append_message('End of candidates.');
			}
		};
	}(this);


}

