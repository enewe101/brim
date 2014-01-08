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


// * Connection settings and state //

// * Signalling state //


window.onbeforeunload = function() {
	signaller.send_message('bye', "{'type':'bye'}");
}


function RTCConnectionObj(signaller) {
	this.msgQueue = [];
	this.started = initiator;
	this.pc = null;
	this.ready_for_offers = false
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

	// Connection settings
	this.stereo = false;
	this.audio_send_codec = '';
	this.offerConstraints = {"optional": [], "mandatory": {}};
	this.audio_receive_codec = 'opus/48000';
	this.gatheredIceCandidateTypes = { Local: {}, Remote: {} };
	this.isVideoMuted = false;
	this.isAudioMuted = false;
	this.sdpConstraints = {
		'mandatory': {
			'OfferToReceiveAudio': true,
			'OfferToReceiveVideo': true 
		}
	};
	this.pcConfig = {
		"iceServers": [
			{"url": "stun:stun.services.mozilla.com"}
		]
	};
	this.pcConstraints = {
		"optional": [
			{"DtlsSrtpKeyAgreement": true},
			{RtpDataChannels: true}
		]
	};

	// TODO: user runs this right after construction: make it fire as part of 
	// construction?
	this.init = function() {
		// TODO: make this into a signalling object, 
		// separate signalling implementation from rtc_connection obj 
		this.signaller.open(this.message_handler);
	};


	// callback when receiving signalling messages
	// note that the non-initiator equeues messages until she is ready
	// to start processing them
	this.message_handler = function(o) {
		return function(parsed_message) {
			// for other message types, enque if you are not ready
			if(!initiator && !o.started) {
				if(parsed_message.type == 'offer') {
					o.msgQueue.unshift(parsed_message);
					o.signaller.append_message('received offer');
					o.got_offer = true;
					o.maybe_start_processing_signals();
				} else {
					o.msgQueue.push(parsed_message);
				}
			} else {
				o.processSignalingMessage(parsed_message);
			}
		}
	}(this);


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
			this.pc = new RTCPeerConnection(this.pcConfig, this.pcConstraints);
			this.pc.onicecandidate = this.onIceCandidate; 
			console.log('Created RTCPeerConnnection');
		} catch (e) {
			console.log(
			'Failed to create PeerConnection, exception: ' + e.message);
			return;
		}

		if(this.do_expect_video_channel) {
			this.pc.onaddstream = this.onRemoteStreamAdded;
		}
		if(this.do_expect_data_channel) {
			this.pc.ondatachannel = this.gotReceiveChannel;
		}
		this.pc.onremovestream = this.onRemoteStreamRemoved;
		this.pc.onsignalingstatechange = this.onSignalingStateChanged;
		this.pc.oniceconnectionstatechange = this.onIceConnectionStateChanged;

		console.log('Adding local streams.');

		if(this.channels['video']['send'].length) {
			this.pc.addStream(this.channels['video']['send'][0]);
		}

		for(channel_label in this.channels['data']['send']) {
			var chan = this.pc.createDataChannel(
					channel_label, {reliable: false});

			// store the channel in this.channels
			var send_channels = this.channels['data']['send'];
			send_channels[channel_label]['stream'] = chan;

			// now add handlers from the handler object
			chan.onopen = send_channels[channel_label]['onopen'];
			chan.onclose = send_channels[channel_label]['onclose'];
		}

	};


	this.expectOffer = function() {
		this.ready_for_offers = true;
		this.maybe_start_processing_signals();
	};

	// Create and send a connection offer
	this.doOffer = function() {
		this.signaller.append_message('doCall');
		var constraints = this.mergeConstraints(
			this.offerConstraints, this.sdpConstraints);
		this.signaller.append_message(
			'Sending offer to peer, with constraints: \n' +
			'  \'' + JSON.stringify(constraints) + '\'.')
		this.pc.createOffer(
			this.setLocalAndSendMessage,
		   	this.onCreateSessionDescriptionError,
		   	constraints); // inside setLocal
	};


	// Create and send a connection reply
	this.maybe_start_processing_signals = function() {
		if (!this.started && this.got_offer && this.ready_for_offers) {
			this.started = true;
			while (this.msgQueue.length > 0) {
				this.processSignalingMessage(this.msgQueue.shift());
			}
		} else {
			this.signaller.append_message("...didn't start");
		}
	};

	// Produce an answer for RTC offer
	this.doAnswer = function() {
		try {
			this.pc.createAnswer(
				this.setLocalAndSendMessage,
			   	this.onCreateSessionDescriptionError,
			   	this.sdpConstraints);

		} catch(e) {
			this.signaller.append_message('error sending answer: ' + e);
		}
	};


	// TODO: this should probably be the main callback given to the signalling 
	// object
	this.processSignalingMessage = function(message) {
		this.signaller.append_message('processing: ' + message);

		// TODO: I don't think this is needed because the joining peer 
		// initiates using a connection offer.  I think we don't need the join 
		// signal.
		//if(message.type == 'join') {
		//	alert('jain');
		//	this.signaller.append_message('newPeerHere = true');
		//	newPeerHere = true;
		//	this.request_connection();
		//}

		// It should not be possible to get this condition
		if (!this.started) {
			alert('not started!');
			throw 'peerConnection has not been created yet!';
			return;
		}

		this.signaller.append_message('<strong>' + message.type + '</strong>');
		// Respond to offers
		if (message.type === 'offer') {
			this.signaller.append_message('...reading offer...');
			try {
				var offer = eval('(' + message['message'] + ')');
			} catch(e) {
				this.signaller.append_message(
					'invalid message: ' + message['message']);
			}
			this.setRemote(offer);
			this.signaller.append_message('do answer now');
			this.doAnswer();

		// Respond to answers
		} else if (message.type === 'answer') {
			this.signaller.append_message('...reading answer...');
			try {
				var answer = eval('(' + message['message'] + ')');
			} catch(e) {
				this.signaller.append_message(
					'invalid message: ' + message['message']);
			}
			this.setRemote(answer);

		// Respond to ice candidates
		} else if (message.type === 'candidate') {
			this.signaller.append_message('...reading candidate...');
			try {
				var answer = eval('(' + message['message'] + ')');
			} catch(e) {
				this.signaller.append_message(
					'invalid message: ' + message['message']);
			}
			this.signaller.append_message('...candidate parsed...');
			var candidate = new RTCIceCandidate({sdpMLineIndex: message.label,
											 candidate: message.candidate});
			this.signaller.append_message('...candidate built...');
			this.noteIceCandidate("Remote", this.iceCandidateType(message.candidate));
			this.pc.addIceCandidate(candidate);

		// respond to hangup
		} else if (message.type === 'bye') {
			this.onRemoteHangup();
		}
	};


	this.onUserMediaError = function(o) {
		return function() {
			o.signaller.append_message('userMediaFalied');
		};
	}(this);

	this.onRemoteStreamAdded = function(o) {
		return function(event) {
			console.log('Remote stream added.');

			o.channels['video']['send']['stream'] = event.stream;

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
		this.signaller.append_message('waitForRemoteVideo');
		videoTracks = o.channels['video']['send']['stream'].getVideoTracks();

		// Originally remoteVideo was a global containing the video html
		// element to which the remote stream gets attached.
		//if (videoTracks.length === 0 || remoteVideo.currentTime > 0) {
		if (videoTracks.length === 0) {
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
			  o.signaller.append_message('End of candidates.');
			}
		};
	}(this);

	this.onIceConnectionStateChanged = function(o) {
		return function(event) {
		  o.signaller.append_message('onIceConnectionStateChanged');
		};
	}(this);


	this.onSignalingStateChanged = function(o) {
		return function(event) {
		  o.signaller.append_message('onSignalStateChange');
		};
	}(this);


	this.onRemoteStreamRemoved = function(o) {
		return function(event) {
		  o.signaller.append_message('Remote stream removed.');
		};
	}(this);


	this.gotReceiveChannel = function(o) {
		return function(event) {
			o.signaller.append_message('Receive Channel Callback');
			var chan = event.channel;
			var label = chan.label;

			if(label in o.channels['data']['receive']) {

				// bind the callbacks passed in from the application
				var short_name = o.channels['data']['receive'][label];
				chan.onmessage = short_name['onmessage'];
				chan.onopen = short_name['onopen'];
				chan.onclose = short_name['onclose'];

				// store the data channel
				expected_data[label]['stream'] = chan;
			}
		};
	}(this);


	// TODO: merge close_connection() and onRemoteHangup() or indicate what
	// their unique purposes are in a short comment

	// This duplicates some functionality of this.onRemoteHangup
	this.close_connection = function() {
		alert('close data channels!');
		this.signaller.append_message('Closing data channels');

		for(chan in this.channels['data']['send']) {
			this.channels['data']['send'][chan]['stream'].close();
		}
	
		// this should be registered to this.channels dictionnary so that it
		// can be closed by iterating through open registered channels...
		for(chan in this.channels['data']['receive']) {
			this.channels['data']['receive'][chan]['stream'].close();
		}
		this.pc.close();
		this.pc = null;
	}

	// Handle hangup.  Does this duplicate functionality of close_connection?
	this.onRemoteHangup = function() {
	  this.signaller.append_message('Session terminated.');
	  initiator = 0;
	  this.stop();
	};

	this.stop = function() {
		this.started = false;
		this.ready_for_offers = false;
		this.got_offer = false;
		this.isAudioMuted = false;
		this.isVideoMuted = false;
		this.pc.close();
		this.pc = null;
		this.msgQueue.length = 0;
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
	  if (this.gatheredIceCandidateTypes[location][type])
		return;
	  this.gatheredIceCandidateTypes[location][type] = 1;
	  this.signaller.append_message('candidate noted');
	};


	this.onCreateSessionDescriptionError = function(o) {
		return function(error) {
			o.signaller.append_message(
				'Failed to create session description: ' + error.toString());
		};
	}(this);


	this.setLocalAndSendMessage = function(o) {
		return function(sessionDescription) {
			// Resolve the session description
			sessionDescription.sdp = o.maybePreferAudioReceiveCodec(
					sessionDescription.sdp);

			// Set session description locally
			o.pc.setLocalDescription(
				sessionDescription,
				o.onSetSessionDescriptionSuccess,
			   	o.onSetSessionDescriptionError);

			// Send the offer | answer
			typ = initiator? 'offer' : 'answer';
			o.signaller.append_message('Sending ' + typ + ' to peer');
			o.signaller.send_message(typ, JSON.stringify(sessionDescription));
		};
	}(this);


	this.onSetSessionDescriptionError = function(o) {
		return function(error) {
			o.signaller.append_message(
				'Failed to set session description: ' + error.toString());
		};
	}(this);

	this.onSetSessionDescriptionSuccess = function(o) {
		return function() {
			o.signaller.append_message('Set session description success.');
		};
	}(this);

	this.maybePreferAudioReceiveCodec = function(sdp) {
		if (this.audio_receive_codec == '') {
			this.signaller.append_message(
				'No preference on audio receive codec.');
			return sdp;
		}
		this.signaller.append_message('Prefer audio receive codec: ' + this.audio_receive_codec);
		return this.preferAudioCodec(sdp, this.audio_receive_codec);
	}

	//// Set |codec| as the default audio codec if it's present.
	//// The format of |codec| is 'NAME/RATE', e.g. 'opus/48000'.
	this.preferAudioCodec = function(sdp, codec) {
	  var fields = codec.split('/');
	  if (fields.length != 2) {
		this.signaller.append_message('Invalid codec setting: ' + codec);
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
		this.signaller.append_message('setting remote...');
	  // Set Opus in Stereo, if stereo enabled.
		if (this.stereo) {
			message.sdp = addStereo(message.sdp);
		}
		message.sdp = this.maybePreferAudioSendCodec(message.sdp);
		this.signaller.append_message('set preference');
		var sd = new RTCSessionDescription(message);
		this.signaller.append_message('made remote description obj');
		this.pc.setRemoteDescription(sd,
			this.onSetSessionDescriptionSuccess, this.onSetSessionDescriptionError);
		this.signaller.append_message('done setting remote');
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
		this.signaller.append_message('setting preference');
	  if (this.audio_send_codec == '') {
		this.signaller.append_message('No preference on audio send codec.');
		return sdp;
	  }
	  this.signaller.append_message('Prefer audio send codec: ' + this.audio_send_codec);
	  return this.preferAudioCodec(sdp, this.audio_send_codec);
	}




}

