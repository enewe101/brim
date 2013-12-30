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
var sendChannel;
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

var rtc_connection_obj;

function append_message(msg) {
	message = new Element('div');
	message.update(msg);
	message_pane.insert({'bottom':message});
}

window.onbeforeunload = function() {
	send_message(room_id, client_id, 'bye', "{'type':'bye'}");
}


function RTCConnectionObj() {
	rtc_connection_obj = this;

	this.test = function() {
		alert('rtc_obj');
	};

	this.init = function() {
		message_input = $('message_input');
		message_input.onkeydown = check_key;
		message_pane = $('message_pane');
		localVideo = $('local_video');
		remoteVideo = $('remote_video');
		dataChannelSend = $('dataChannelSend');
		dataChannelReceive = $('dataChannelReceive');
		sendButton = $('sendButton');
		closeButton = $('closeButton');
		
		begin_polling(2000, this.message_handler);
		//this.doGetUserMedia();
	};

	this.doGetUserMedia = function() {
		// Call into getUserMedia via the polyfill (adapter.js).
		try {
			getUserMedia(mediaConstraints, this.onUserMediaSuccess, this.onUserMediaError);
			append_message('local request to access media')
		} catch (e) {
			append_message('getUserMedia failed with exception: ' + e.message);
		}
	};

	this.onUserMediaError = function() {
		append_message('userMediaFalied');
	};

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
						o.maybeStart();
					} else {
						msgQueue.push(messages[i]);
					}
				} else {
					o.processSignalingMessage(messages[i]);
				}
			}
		};
	}(this);


	this.closeDataChannels = function() {
		alert('close data channels!');
		append_message('Closing data channels');

		sendChannel.close();
		trace('Closed data channel with label: ' + sendChannel.label);
		receiveChannel.close();
		trace('Closed data channel with label: ' + receiveChannel.label);
		pc.close();
		pc = null;

		dataChannelSend.value = "";
		dataChannelReceive.value = "";
		dataChannelSend.disabled = true;
		alert('data channels closed!');
	}

	this.onUserMediaSuccess = function(o) {
		return function(stream) {
			append_message('User has granted access to local media.');

			// REENTER HERE
			// re-enter connection object file here
			attachMediaStream(localVideo, stream);
			localVideo.style.opacity = 1;
			localStream = stream;
			// Caller creates PeerConnection.
			o.maybeStart();
		};
	}(this);

	this.attatch_channel = function(stream) {
		attachMediaStream(localVideo, stream);

		// APPLICATION
		localVideo.style.opacity = 1;
		localStream = stream;

		// This should get called from the application but live here
		this.maybeStart();
	};


	// this could be done in two versions: request_PC, and reply_PC
	// Request Peer connection
	this.maybeStart = function() {
		append_message('maybe start... ');

		if (!started && signalling_ready && localStream) {
			append_message('Creating PeerConnection.');
			this.createPeerConnection();
			append_message('Adding local stream.');

			// this should add from a dict of added streams
			pc.addStream(localStream);
			try {
				sendChannel = pc.createDataChannel("text_data_channel",
					{reliable: false});
			} catch (e) {
				alert('failed to make dataChannel');
			}

			// pass a handler to the dict of added streams
			sendChannel.onopen = this.handleSendChannelStateChange;
			sendChannel.onclose = this.handleSendChannelStateChange;

			started = true;

			if (initiator) {
			  this.doCall(); //inside
			} else {
			  this.calleeStart();
			}
		} else {
			append_message("...didn't start");
		}
	};

	this.calleeStart = function() {
	  // Callee starts to process cached offer and other messages.
	  while (msgQueue.length > 0) {
		this.processSignalingMessage(msgQueue.shift());
	  }
	};

	this.processSignalingMessage = function(message) {
		append_message('processing: ' + message);

		if(message.type == 'join') {
			append_message('newPeerHere = true');
			newPeerHere = true;
			this.maybeStart();
		}

		if (!started) {
			append_message('peerConnection has not been created yet!');
			return;
		}

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
		} else if (message.type === 'answer') {
			append_message('...reading answer...');
			try {
				var answer = eval('(' + message['message'] + ')');
			} catch(e) {
				append_message('invalid message: ' + message['message']);
			}
			this.setRemote(answer);
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
		} else if (message.type === 'bye') {
			this.onRemoteHangup();
		}
	};

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

	this.iceCandidateType = function(candidateSDP) {
	  if (candidateSDP.indexOf("typ relay ") >= 0)
		return "TURN";
	  if (candidateSDP.indexOf("typ srflx ") >= 0)
		return "STUN";
	  if (candidateSDP.indexOf("typ host ") >= 0)
		return "HOST";
	  return "UNKNOWN";
	};

	this.noteIceCandidate = function(location, type) {
	  if (gatheredIceCandidateTypes[location][type])
		return;
	  gatheredIceCandidateTypes[location][type] = 1;
	  append_message('candidate noted');
	};

	this.doAnswer = function() {
		try {
			pc.createAnswer(this.setLocalAndSendMessage, this.onCreateSessionDescriptionError, sdpConstraints);
		} catch(e) {
			append_message(e);
		}
	};

	this.onCreateSessionDescriptionError = function(error) {
	  append_message('Failed to create session description: ' + error.toString());
	}

	this.setLocalAndSendMessage = function(o) {
		return function(sessionDescription) {
			sessionDescription.sdp = o.maybePreferAudioReceiveCodec(sessionDescription.sdp);
			pc.setLocalDescription(sessionDescription,
				o.onSetSessionDescriptionSuccess, o.onSetSessionDescriptionError);
			//sendMessage(sessionDescription);
			typ = initiator? 'offer' : 'answer';
			append_message('Sending ' + typ + ' to peer');
			send_message(room_id, client_id, typ, JSON.stringify(sessionDescription));
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

	this.doCall = function() {
		append_message('doCall');
	  var constraints = this.mergeConstraints(offerConstraints, sdpConstraints);
	  append_message('Sending offer to peer, with constraints: \n' +
				  '  \'' + JSON.stringify(constraints) + '\'.')
	  pc.createOffer(this.setLocalAndSendMessage,
					 this.onCreateSessionDescriptionError, constraints); // inside setLocal
	};

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

	this.handleSendChannelStateChange = function(o) {
		return function() {
		  var readyState = sendChannel.readyState;
		  append_message('Send channel state is: ' + readyState);
		  if (readyState == "open") {
			dataChannelSend.disabled = false;
			dataChannelSend.focus();
			dataChannelSend.value = "";
			sendButton.onclick = o.send_text_and_clear;
			
			closeButton.onclick = o.closeDataChannels;
		  } else {
			dataChannelSend.disabled = true;
			alert('handled channel ' + readyState);
		  }
		};
	}(this);

	this.send_text_and_clear = function(o) {
		return function() {
			append_message('Sending data: ' + data);
			var data = dataChannelSend.value;
			sendChannel.send(data);
			dataChannelSend.value = '';
			append_message('Sent data: ' + data + '!!');
		};
	}(this);

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

	this.gotReceiveChannel = function(o) {
		return function(event) {
		  append_message('Receive Channel Callback');
		  receiveChannel = event.channel;
		  receiveChannel.onmessage = o.handleMessage;
		  receiveChannel.onopen = o.handleReceiveChannelStateChange;
		  receiveChannel.onclose = o.handleReceiveChannelStateChange;
		};
	}(this);

	this.handleReceiveChannelStateChange = function() {
	  var readyState = receiveChannel.readyState;
	  append_message('Receive channel state is: ' + readyState);
	};

	this.handleMessage = function(event) {
	  append_message('Received message: ' + event.data);
	  dataChannelReceive.value = dataChannelReceive.value + '\n' + event.data;
	};

	this.onRemoteStreamAdded = function(o) {
		return function(event) {
		  append_message('Remote stream added.');
		//  reattachMediaStream(miniVideo, localVideo);
		  attachMediaStream(remoteVideo, event.stream);
		  remoteStream = event.stream;
		  this.waitForRemoteVideo();
		};
	}(this);

	this.waitForRemoteVideo = function() {
		append_message('waitForRemoteVideo');
	  // Call the getVideoTracks method via adapter.js.
	  videoTracks = remoteStream.getVideoTracks();
	  if (videoTracks.length === 0 || remoteVideo.currentTime > 0) {
		this.transitionToActive(); //mostly off
	  } else {
		setTimeout(this.waitForRemoteVideo, 100);
	  }
	};

	this.transitionToActive = function() {
	  remoteVideo.style.opacity = 1;
	//  card.style.webkitTransform = 'rotateY(180deg)';
	//  setTimeout(function() { localVideo.src = ''; }, 500);
	  setTimeout(function() { miniVideo.style.opacity = 1; }, 1000);
	//  // Reset window display according to the asperio of remote video.
	//  window.onresize();
	//  setStatus('<input type=\'button\' id=\'hangup\' value=\'Hang up\' \
	//            onclick=\'onHangup()\' />');
	}

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

