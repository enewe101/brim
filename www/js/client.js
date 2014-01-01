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
var message_input;
var message_pane;
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
var pc;

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

function append_message(msg) {
	message = new Element('div');
	message.update(msg);
	message_pane.insert({'bottom':message});
}

window.onbeforeunload = function() {
	send_message(room_id, client_id, 'bye', "{'type':'bye'}");
}


function RTCConnectionObj() {


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
		begin_polling(2000, this.message_handler);
	};


	this.onUserMediaError = function() {
		append_message('userMediaFalied');
	};


	// TODO: move this out to application.  It will help get the pollign
	// object ready part of this will probably go to the polling object code
	this.message_handler = function(o) {
		return function(response_text) {
			messages = eval(response_text);
			messages = messages.filter(is_new_signal);

			for(var i=0; i<messages.length; i++) { 
				last_signal_id = messages[i]['signal_id'];
				last_msg_timestamp = messages[i]['timestamp'];
				msg = messages[i]['message'];

				//message type 'message' is used for plain text -- always let them through
				if(messages[i].type == 'message') {
					append_message("<span class='blue'><span class='bold'>Other: </span>" + msg + "</span>");
				}

				// for other message types, enque if you are not ready
				if(!initiator && !started) {
					if(messages[i].type == 'offer') {
						msgQueue.unshift(messages[i]);
						append_message('received offer');
						signalling_ready = true
						o.request_connection();
					} else {
						msgQueue.push(messages[i]);
					}
				} else {
					o.processSignalingMessage(messages[i]);
				}
			}
		};
	}(this);


	// This duplicates some functionality of this.onRemoteHangup
	this.close_connection = function() {
		alert('close data channels!');
		append_message('Closing data channels');

		for(chan in this.channels['data']['send']) {
			this.channels['data']['send'][chan]['stream'].close();
		}
	
		// this should be registered to this.channels dictionnary so that it
		// can be closed by iterating through open registered channels...
		receiveChannel.close();
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
		this.channels['data']['receive'][nickname] = handler;
	};

	this.expect_video_channel = function(handler) {
		this.channels['video']['receive'] = handler;
	};

	// Request Peer connection
	this.request_connection = function() {
		append_message('maybe start... ');

		if (!started && signalling_ready && localStream) {
			append_message('Creating PeerConnection.');
			on_add_channel_handlers = null;
			this.createPeerConnection();
			append_message('Adding local stream.');

			// this should add from a dict of added streams
			// make this attatch based on reference in this.channels
			// instead of localStream global reference
			//
			// Is it possible to have multiple video send streams?
			// i.e. do we need this.channels['video']['send'] to be array?
			if(this.channels['video']['send'].length) {
				pc.addStream(this.channels['video']['send'][0]);
			}

			for(chan in this.channels['data']['send']) {
				var new_channel = pc.createDataChannel(
						"text_data_channel", {reliable: false});

				// now add handlers from the handler object
				var new_data_channel = this.channels['data']['send'][chan];
				new_data_channel['stream'] = new_channel;
				new_channel.onopen = new_data_channel['onopen'];
				new_channel.onclose = new_data_channel['onclose'];
			}

			started = true;

			// The initiator makes the offer, the other answers
			if (initiator) {
			  this.doOffer();
			} else {
			  this.doAnser();
			}
		} else {
			append_message("...didn't start");
		}
	};


	// Create and send a connection offer
	this.doOffer = function() {
		append_message('doCall');
		var constraints = this.mergeConstraints(
			offerConstraints, sdpConstraints);
		append_message(
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


	// TODO: this should probably be the main callback given to the signalling 
	// object
	this.processSignalingMessage = function(message) {
		append_message('processing: ' + message);

		// TODO: I don't think this is needed because the joining peer 
		// initiates using a connection offer.  I think we don't need the join 
		// signal.
		//if(message.type == 'join') {
		//	alert('jain');
		//	append_message('newPeerHere = true');
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
			append_message('...reading offer...');
			try {
				var offer = eval('(' + message['message'] + ')');
			} catch(e) {
				append_message('invalid message: ' + message['message']);
			}
			this.setRemote(offer);
			append_message('do answer now');
			this.doAnswer();

		// Respond to answers
		} else if (message.type === 'answer') {
			append_message('...reading answer...');
			try {
				var answer = eval('(' + message['message'] + ')');
			} catch(e) {
				append_message('invalid message: ' + message['message']);
			}
			this.setRemote(answer);

		// Respond to ice candidates
		} else if (message.type === 'candidate') {
			append_message('...reading candidate...');
			try {
				var answer = eval('(' + message['message'] + ')');
			} catch(e) {
				append_message('invalid message: ' + message['message']);
			}
			append_message('...candidate parsed...');
			var candidate = new RTCIceCandidate({sdpMLineIndex: message.label,
											 candidate: message.candidate});
			append_message('...candidate built...');
			this.noteIceCandidate("Remote", this.iceCandidateType(message.candidate));
			pc.addIceCandidate(candidate);

		// respond to hangup
		} else if (message.type === 'bye') {
			this.onRemoteHangup();
		}
	};


	// Handle hangup.  Does this duplicate functionality of close_connection?
	this.onRemoteHangup = function() {
	  append_message('Session terminated.');
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
	  append_message('candidate noted');
	};


	// Produce an answer for RTC offer
	this.doAnswer = function() {
		try {
			pc.createAnswer(
				this.setLocalAndSendMessage,
			   	this.onCreateSessionDescriptionError,
			   	sdpConstraints);

		} catch(e) {
			append_message(e);
		}
	};


	this.onCreateSessionDescriptionError = function(error) {
		append_message(
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
			append_message('Sending ' + typ + ' to peer');
			send_message(room_id, client_id, typ, 
				JSON.stringify(sessionDescription));
		};
	}(this);


	this.onSetSessionDescriptionError = function(error) {
	  append_message('Failed to set session description: ' + error.toString());
	}

	this.onSetSessionDescriptionSuccess = function() {
	  append_message('Set session description success.');
	}

	this.maybePreferAudioReceiveCodec = function(sdp) {
		if (audio_receive_codec == '') {
			append_message('No preference on audio receive codec.');
			return sdp;
		}
		append_message('Prefer audio receive codec: ' + audio_receive_codec);
		return this.preferAudioCodec(sdp, audio_receive_codec);
	}

	//// Set |codec| as the default audio codec if it's present.
	//// The format of |codec| is 'NAME/RATE', e.g. 'opus/48000'.
	this.preferAudioCodec = function(sdp, codec) {
	  var fields = codec.split('/');
	  if (fields.length != 2) {
		append_message('Invalid codec setting: ' + codec);
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
		append_message('setting remote...');
	  // Set Opus in Stereo, if stereo enabled.
		if (stereo) {
			message.sdp = addStereo(message.sdp);
		}
		message.sdp = this.maybePreferAudioSendCodec(message.sdp);
		append_message('set preference');
		var sd = new RTCSessionDescription(message);
		append_message('made remote description obj');
		pc.setRemoteDescription(sd,
			this.onSetSessionDescriptionSuccess, this.onSetSessionDescriptionError);
		append_message('done setting remote');
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
		append_message('setting preference');
	  if (audio_send_codec == '') {
		append_message('No preference on audio send codec.');
		return sdp;
	  }
	  append_message('Prefer audio send codec: ' + audio_send_codec);
	  return this.preferAudioCodec(sdp, audio_send_codec);
	}


	// Build the peer connection, which does most of the important actual 
	// data transfer and its negotiation
	this.createPeerConnection = function() {
		append_message('Creating RTCPeerConnnection');
		try {
			// Create an RTCPeerConnection via the polyfill (adapter.js).
			pc = new RTCPeerConnection(pcConfig, pcConstraints);
			pc.onicecandidate = this.onIceCandidate; 
			append_message('Created RTCPeerConnnection');
		} catch (e) {
			append_message('Failed to create PeerConnection, exception: ' + e.message);
		  return;
	  }

		var video_receive_handler = this.channels['video']['receive'];
		if(video_receive_handler) {
			alert(video_receive_handler.toSource());
		}

		pc.onaddstream = this.onRemoteStreamAdded;
		pc.ondatachannel = this.gotReceiveChannel;
		pc.onremovestream = this.onRemoteStreamRemoved;
		pc.onsignalingstatechange = this.onSignalingStateChanged;
		pc.oniceconnectionstatechange = this.onIceConnectionStateChanged;
	};


	this.onIceConnectionStateChanged = function(event) {
	  append_message('onIceConnectionStateChanged');
	};

	this.onSignalingStateChanged = function(event) {
	  append_message('onSignalStateChange');
	};

	this.onRemoteStreamRemoved = function(event) {
	  append_message('Remote stream removed.');
	};


	// TODO: let the callbacks be placed by the application layer
	// 	at the same time as specifying the send channels
	// 	Also need to do the same with the video channel
	this.gotReceiveChannel = function(o) {
		return function(event) {
		  append_message('Receive Channel Callback');
		  receiveChannel = event.channel;

		  // implement by passing a handler from the application
		  receiveChannel.onmessage = o.handleMessage;
		  receiveChannel.onopen = o.handleReceiveChannelStateChange;
		  receiveChannel.onclose = o.handleReceiveChannelStateChange;
		};
	}(this);

	this.handleMessage = function(event) {
	  append_message('Received message: ' + event.data);
	  dataChannelReceive.value = dataChannelReceive.value + '\n' + event.data;
	};

	this.onRemoteStreamAdded = function(o) {
		return function(event) {
			append_message('Remote stream added.');
			attachMediaStream(remoteVideo, event.stream);
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
		append_message('waitForRemoteVideo');
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
				send_message(room_id, client_id, 'candidate', JSON.stringify({
					type: 'candidate',
					label: event.candidate.sdpMLineIndex,
					id: event.candidate.sdpMid,
					candidate: event.candidate.candidate}));
				o.noteIceCandidate("Local", o.iceCandidateType(event.candidate.candidate));
			} else {
			  append_message('End of candidates.');
			}
		};
	}(this);


}

