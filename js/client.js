// add logic: doCall should only be done if there is a new person who has joined the room
// Also, doCall should maybeFire as soon as a new person has joined or anything needed
// for it to preceed is added.  THings needed for it to proceed
// 	- local stream
// 	
var message_input;
var message_pane;
var localVideo;
var localStream;
var remoteVideo;
var remoteStream;
var pc;
var msgQueue = [];
var stereo = false;
var audio_send_codec = '';

var sdpConstraints = {'mandatory': {
                      'OfferToReceiveAudio': true,
                      'OfferToReceiveVideo': true }};
var pcConfig = {"iceServers": [{"url": "stun:stun.services.mozilla.com"}]};
var pcConstraints = {"optional": [{"DtlsSrtpKeyAgreement": true}]};
var offerConstraints = {"optional": [], "mandatory": {}};
var mediaConstraints = {"audio": true, "video": true};
var audio_receive_codec = 'opus/48000';
var gatheredIceCandidateTypes = { Local: {}, Remote: {} };

// READINESS STATE //
var signalling_ready = initiator;
var localStream = null;
var started = false;
var newPeerHere = false

// OTHER STREAM STATE //
var isVideoMuted = false;
var isAudioMuted = false;

function init_webrtc() {
	alert('webrtc');
	message_input = $('message_input');
	message_input.onkeydown = check_key;
	message_pane = $('message_pane');
	localVideo = $('local_video');
	remoteVideo = $('remote_video');

	begin_polling(2000, message_handler);
	doGetUserMedia();
}


function doGetUserMedia() {
	// Call into getUserMedia via the polyfill (adapter.js).
	try {
		getUserMedia(mediaConstraints, onUserMediaSuccess, onUserMediaError);
		append_message(orange_italic('local request to access media'))
	} catch (e) {
		append_message(brown_bold('getUserMedia failed with exception: ' + e.message));
	}
}

function orange_italic(text) {
	return "<span class='italic'><span class='orange'>" + text + "</span></span>";
}


function brown_bold(text) {
	return "<span class='bold'><span class='brown'>" + text + "</span></span>";
}


function onUserMediaSuccess(stream) {
  append_message(orange_italic('User has granted access to local media.'));
  // Call the polyfill wrapper to attach the media stream to this element.
  // unchecked
  attachMediaStream(localVideo, stream);
  localVideo.style.opacity = 1;
  localStream = stream;
  // Caller creates PeerConnection.
  maybeStart();
}


function maybeStart() {
	append_message(orange_italic('maybe start... '));

	// initiator needs to wait for a new peer to arrive, and should have set up it's local stream
	// visitor needs to wait for an offer, and should have set up localStream
	if (!started && signalling_ready && localStream) {
		append_message(orange_italic('Creating PeerConnection.'));
		createPeerConnection();
		append_message(orange_italic('Adding local stream.'));
		pc.addStream(localStream);
		started = true;

		if (initiator) {
		  doCall(); //inside
		} else {
		  calleeStart();
		}
	} else {
		append_message("...didn't start");
	}
}


// This is how the anitiator sends over the session description.  We'll need the 
// joiner to handle the message type 'offer' properly, and initiate a reply
function doCall() {
	append_message('doCall');
  var constraints = mergeConstraints(offerConstraints, sdpConstraints);
  append_message(orange_italic('Sending offer to peer, with constraints: \n' +
              '  \'' + JSON.stringify(constraints) + '\'.'))
  pc.createOffer(setLocalAndSendMessage,
                 onCreateSessionDescriptionError, constraints); // inside setLocal
}

function setLocalAndSendMessage(sessionDescription) {
	sessionDescription.sdp = maybePreferAudioReceiveCodec(sessionDescription.sdp);
	pc.setLocalDescription(sessionDescription,
		onSetSessionDescriptionSuccess, onSetSessionDescriptionError);
	//sendMessage(sessionDescription);
	typ = initiator? 'offer' : 'answer';
	append_message('Sending ' + typ + ' to peer');
	send_message(room_id, client_id, typ, JSON.stringify(sessionDescription));
}

function mergeConstraints(cons1, cons2) {
  var merged = cons1;
  for (var name in cons2.mandatory) {
    merged.mandatory[name] = cons2.mandatory[name];
  }
  merged.optional.concat(cons2.optional);
  return merged;
}

function createPeerConnection() {
	append_message('Creating RTCPeerConnnection');
	try {
		// Create an RTCPeerConnection via the polyfill (adapter.js).
		pc = new RTCPeerConnection(pcConfig, pcConstraints);
		pc.onicecandidate = onIceCandidate; 
		append_message('Created RTCPeerConnnection');
	} catch (e) {
    	append_message(brown_bold('Failed to create PeerConnection, exception: ' + e.message));
      return;
  }
	pc.onaddstream = onRemoteStreamAdded;
	pc.onremovestream = onRemoteStreamRemoved;
	pc.onsignalingstatechange = onSignalingStateChanged;
	pc.oniceconnectionstatechange = onIceConnectionStateChanged;
}

function onRemoteStreamAdded(event) {
  append_message(orange_italic('Remote stream added.'));
//  reattachMediaStream(miniVideo, localVideo);
  attachMediaStream(remoteVideo, event.stream);
  remoteStream = event.stream;
  waitForRemoteVideo();
}


function onRemoteStreamRemoved(event) {
  append_message(orange_italic('Remote stream removed.'));
}

function onIceConnectionStateChanged(event) {
  append_message(orange_italic('onIceConnectionStateChanged'));
}

function onSignalingStateChanged(event) {
  append_message(orange_italic('onSignalStateChange'));
}

function waitForRemoteVideo() {
	append_message('waitForRemoteVideo');
  // Call the getVideoTracks method via adapter.js.
  videoTracks = remoteStream.getVideoTracks();
  if (videoTracks.length === 0 || remoteVideo.currentTime > 0) {
    transitionToActive(); //mostly off
  } else {
    setTimeout(waitForRemoteVideo, 100);
  }
}


function transitionToActive() {
  remoteVideo.style.opacity = 1;
//  card.style.webkitTransform = 'rotateY(180deg)';
//  setTimeout(function() { localVideo.src = ''; }, 500);
  setTimeout(function() { miniVideo.style.opacity = 1; }, 1000);
//  // Reset window display according to the asperio of remote video.
//  window.onresize();
//  setStatus('<input type=\'button\' id=\'hangup\' value=\'Hang up\' \
//            onclick=\'onHangup()\' />');
}


function onIceCandidate(event) {
	if(event.candidate) {
		send_message(room_id, client_id, 'candidate', JSON.stringify({
			type: 'candidate',
			label: event.candidate.sdpMLineIndex,
			id: event.candidate.sdpMid,
			candidate: event.candidate.candidate}));
		noteIceCandidate("Local", iceCandidateType(event.candidate.candidate));
	} else {
	  append_message('End of candidates.');
	}
}


function onUserMediaError() {
	append_message('userMediaFalied');
}


function message_handler(response_text) {
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
				maybeStart();
			} else {
				msgQueue.push(messages[i]);
			}
		} else {
			processSignalingMessage(messages[i]);
		}
	}
}

function append_message(msg) {
	message = new Element('div');
	message.update(msg);
	message_pane.insert({'bottom':message});
}


// 
// MIX MIX MIX
//


//function maybeStart() {
//  if (!started && signalingReady &&
//      localStream && channelReady && turnDone) {
//    setStatus('Connecting...');
//    console.log('Creating PeerConnection.');
//    createPeerConnection();
//    console.log('Adding local stream.');
//    pc.addStream(localStream);
//    started = true;
//
//    if (initiator)
//      doCall();
//    else
//      calleeStart();
//  }
//}
//
//function setStatus(state) {
//  document.getElementById('status').innerHTML = state;
//}
//
//function doCall() {
//  var constraints = mergeConstraints(offerConstraints, sdpConstraints);
//  console.log('Sending offer to peer, with constraints: \n' +
//              '  \'' + JSON.stringify(constraints) + '\'.')
//  pc.createOffer(setLocalAndSendMessage,
//                 onCreateSessionDescriptionError, constraints);
//}

function calleeStart() {
  // Callee starts to process cached offer and other messages.
  while (msgQueue.length > 0) {
    processSignalingMessage(msgQueue.shift());
  }
}

function doAnswer() {
	try {
		pc.createAnswer(setLocalAndSendMessage, onCreateSessionDescriptionError, sdpConstraints);
	} catch(e) {
		append_message(e);
	}
}


//function mergeConstraints(cons1, cons2) {
//  var merged = cons1;
//  for (var name in cons2.mandatory) {
//    merged.mandatory[name] = cons2.mandatory[name];
//  }
//  merged.optional.concat(cons2.optional);
//  return merged;
//}
//
//function setLocalAndSendMessage(sessionDescription) {
//  sessionDescription.sdp = maybePreferAudioReceiveCodec(sessionDescription.sdp);
//  pc.setLocalDescription(sessionDescription,
//       onSetSessionDescriptionSuccess, onSetSessionDescriptionError);
//  sendMessage(sessionDescription);
//}

function setRemote(message) {
	append_message('setting remote...');
  // Set Opus in Stereo, if stereo enabled.
	if (stereo) {
		message.sdp = addStereo(message.sdp);
	}
	message.sdp = maybePreferAudioSendCodec(message.sdp);
	append_message('set preference');
	var sd = new RTCSessionDescription(message);
	append_message('made remote description obj');
	pc.setRemoteDescription(sd,
		onSetSessionDescriptionSuccess, onSetSessionDescriptionError);
	append_message('done setting remote');
}

//function sendMessage(message) {
//  var msgString = JSON.stringify(message);
//  console.log('C->S: ' + msgString);
//  // NOTE: AppRTCClient.java searches & parses this line; update there when
//  // changing here.
//  path = '/message?r=' + roomKey + '&u=' + me;
//  var xhr = new XMLHttpRequest();
//  xhr.open('POST', path, true);
//  xhr.send(msgString);
//}
//

function processSignalingMessage(message) {
	append_message('processing: ' + message);

	if(message.type == 'join') {
		append_message('newPeerHere = true');
		newPeerHere = true;
		maybeStart();
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
		setRemote(offer);
		append_message('do answer now');
		doAnswer();
	} else if (message.type === 'answer') {
		append_message('...reading answer...');
		try {
			var answer = eval('(' + message['message'] + ')');
		} catch(e) {
			append_message('invalid message: ' + message['message']);
		}
		setRemote(answer);
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
		noteIceCandidate("Remote", iceCandidateType(message.candidate));
		pc.addIceCandidate(candidate);
	} else if (message.type === 'bye') {
		onRemoteHangup();
	}
}

//function onChannelOpened() {
//  console.log('Channel opened.');
//  channelReady = true;
//  maybeStart();
//}
//function onChannelMessage(message) {
//  console.log('S->C: ' + message.data);
//  var msg = JSON.parse(message.data);
//  // Since the turn response is async and also GAE might disorder the
//  // Message delivery due to possible datastore query at server side,
//  // So callee needs to cache messages before peerConnection is created.
//  if (!initiator && !started) {
//    if (msg.type === 'offer') {
//      // Add offer to the beginning of msgQueue, since we can't handle
//      // Early candidates before offer at present.
//      msgQueue.unshift(msg);
//      // Callee creates PeerConnection
//      signalingReady = true;
//      maybeStart();
//    } else {
//      msgQueue.push(msg);
//    }
//  } else {
//    processSignalingMessage(msg);
//  }
//}
//function onChannelError() {
//  console.log('Channel error.');
//}
//function onChannelClosed() {
//  console.log('Channel closed.');
//}
//
//function onUserMediaSuccess(stream) {
//  console.log('User has granted access to local media.');
//  // Call the polyfill wrapper to attach the media stream to this element.
//  attachMediaStream(localVideo, stream);
//  localVideo.style.opacity = 1;
//  localStream = stream;
//  // Caller creates PeerConnection.
//  maybeStart();
//}
//
//function onUserMediaError(error) {
//  console.log('Failed to get access to local media. Error code was ' +
//              error.code);
//  alert('Failed to get access to local media. Error code was ' +
//        error.code + '.');
//}

function onCreateSessionDescriptionError(error) {
  append_message('Failed to create session description: ' + error.toString());
}

function onSetSessionDescriptionSuccess() {
  append_message('Set session description success.');
}

function onSetSessionDescriptionError(error) {
  append_message('Failed to set session description: ' + error.toString());
}

function iceCandidateType(candidateSDP) {
  if (candidateSDP.indexOf("typ relay ") >= 0)
    return "TURN";
  if (candidateSDP.indexOf("typ srflx ") >= 0)
    return "STUN";
  if (candidateSDP.indexOf("typ host ") >= 0)
    return "HOST";
  return "UNKNOWN";
}

//
//
//function onRemoteStreamRemoved(event) {
//  console.log('Remote stream removed.');
//}
//
//function onSignalingStateChanged(event) {
//  updateInfoDiv();
//}
//
//function onIceConnectionStateChanged(event) {
//  updateInfoDiv();
//}
//
//function onHangup() {
//  console.log('Hanging up.');
//  transitionToDone();
//  localStream.stop();
//  stop();
//  // will trigger BYE from server
//  socket.close();
//}

function onRemoteHangup() {
  append_message('Session terminated.');
  initiator = 0;
  stop();
}

function stop() {
	started = false;
	signalling_ready = false;
	isAudioMuted = false;
	isVideoMuted = false;
	pc.close();
	pc = null;
	msgQueue.length = 0;
}

//function waitForRemoteVideo() {
//  // Call the getVideoTracks method via adapter.js.
//  videoTracks = remoteStream.getVideoTracks();
//  if (videoTracks.length === 0 || remoteVideo.currentTime > 0) {
//    transitionToActive();
//  } else {
//    setTimeout(waitForRemoteVideo, 100);
//  }
//}
//
//function transitionToActive() {
//  remoteVideo.style.opacity = 1;
//  card.style.webkitTransform = 'rotateY(180deg)';
//  setTimeout(function() { localVideo.src = ''; }, 500);
//  setTimeout(function() { miniVideo.style.opacity = 1; }, 1000);
//  // Reset window display according to the asperio of remote video.
//  window.onresize();
//  setStatus('<input type=\'button\' id=\'hangup\' value=\'Hang up\' \
//            onclick=\'onHangup()\' />');
//}
//
//function transitionToWaiting() {
//  card.style.webkitTransform = 'rotateY(0deg)';
//  setTimeout(function() {
//               localVideo.src = miniVideo.src;
//               miniVideo.src = '';
//               remoteVideo.src = '' }, 500);
//  miniVideo.style.opacity = 0;
//  remoteVideo.style.opacity = 0;
//  resetStatus();
//}
//
//function transitionToDone() {
//  localVideo.style.opacity = 0;
//  remoteVideo.style.opacity = 0;
//  miniVideo.style.opacity = 0;
//  setStatus('You have left the call. <a href=' + roomLink + '>\
//            Click here</a> to rejoin.');
//}
//
//function enterFullScreen() {
//  container.webkitRequestFullScreen();
//}

function noteIceCandidate(location, type) {
  if (gatheredIceCandidateTypes[location][type])
    return;
  gatheredIceCandidateTypes[location][type] = 1;
  append_message('candidate noted');
}

//function getInfoDiv() {
//  return document.getElementById("infoDiv");
//}
//
//function updateInfoDiv() {
//  var contents = "<pre>Gathered ICE Candidates\n";
//  for (var endpoint in gatheredIceCandidateTypes) {
//    contents += endpoint + ":\n";
//    for (var type in gatheredIceCandidateTypes[endpoint])
//      contents += "  " + type + "\n";
//  }
//  if (pc != null) {
//    contents += "Gathering: " + pc.iceGatheringState + "\n";
//    contents += "</pre>\n";
//    contents += "<pre>PC State:\n";
//    contents += "Signaling: " + pc.signalingState + "\n";
//    contents += "ICE: " + pc.iceConnectionState + "\n";
//  }
//  var div = getInfoDiv();
//  div.innerHTML = contents + "</pre>";
//}
//
//function toggleInfoDivDisplay() {
//  var div = getInfoDiv();
//  if (div.style.display == "block") {
//    div.style.display = "none";
//  } else {
//    div.style.display = "block";
//  }
//}
//
//function toggleVideoMute() {
//  // Call the getVideoTracks method via adapter.js.
//  videoTracks = localStream.getVideoTracks();
//
//  if (videoTracks.length === 0) {
//    console.log('No local video available.');
//    return;
//  }
//
//  if (isVideoMuted) {
//    for (i = 0; i < videoTracks.length; i++) {
//      videoTracks[i].enabled = true;
//    }
//    console.log('Video unmuted.');
//  } else {
//    for (i = 0; i < videoTracks.length; i++) {
//      videoTracks[i].enabled = false;
//    }
//    console.log('Video muted.');
//  }
//
//  isVideoMuted = !isVideoMuted;
//}
//
//function toggleAudioMute() {
//  // Call the getAudioTracks method via adapter.js.
//  audioTracks = localStream.getAudioTracks();
//
//  if (audioTracks.length === 0) {
//    console.log('No local audio available.');
//    return;
//  }
//
//  if (isAudioMuted) {
//    for (i = 0; i < audioTracks.length; i++) {
//      audioTracks[i].enabled = true;
//    }
//    console.log('Audio unmuted.');
//  } else {
//    for (i = 0; i < audioTracks.length; i++){
//      audioTracks[i].enabled = false;
//    }
//    console.log('Audio muted.');
//  }
//
//  isAudioMuted = !isAudioMuted;
//}
//
//// Mac: hotkey is Command.
//// Non-Mac: hotkey is Control.
//// <hotkey>-D: toggle audio mute.
//// <hotkey>-E: toggle video mute.
//// <hotkey>-I: toggle Info box.
//// Return false to screen out original Chrome shortcuts.
//document.onkeydown = function(event) {
//  var hotkey = event.ctrlKey;
//  if (navigator.appVersion.indexOf('Mac') != -1)
//    hotkey = event.metaKey;
//  if (!hotkey)
//    return;
//  switch (event.keyCode) {
//    case 68:
//      toggleAudioMute();
//      return false;
//    case 69:
//      toggleVideoMute();
//      return false;
//    case 73:
//      toggleInfoDivDisplay();
//      return false;
//    default:
//      return;
//  }
//}

function maybePreferAudioSendCodec(sdp) {
	append_message('setting preference');
  if (audio_send_codec == '') {
	append_message('No preference on audio send codec.');
    return sdp;
  }
  append_message('Prefer audio send codec: ' + audio_send_codec);
  return preferAudioCodec(sdp, audio_send_codec);
}


function maybePreferAudioReceiveCodec(sdp) {
	if (audio_receive_codec == '') {
		append_message('No preference on audio receive codec.');
		return sdp;
	}
	append_message('Prefer audio receive codec: ' + audio_receive_codec);
	return preferAudioCodec(sdp, audio_receive_codec);
}

//// Set |codec| as the default audio codec if it's present.
//// The format of |codec| is 'NAME/RATE', e.g. 'opus/48000'.
function preferAudioCodec(sdp, codec) {
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
      var payload = extractSdp(sdpLines[i], regexp);
      if (payload)
        sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex],
                                               payload);
      break;
    }
  }

  // Remove CN in m line and sdp.
  sdpLines = removeCN(sdpLines, mLineIndex);


  sdp = sdpLines.join('\r\n');
  return sdp;
}

//// Set Opus in stereo if stereo is enabled.
//function addStereo(sdp) {
//  var sdpLines = sdp.split('\r\n');
//
//  // Find opus payload.
//  for (var i = 0; i < sdpLines.length; i++) {
//    if (sdpLines[i].search('opus/48000') !== -1) {
//      var opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
//      break;
//    }
//  }
//
//  // Find the payload in fmtp line.
//  for (var i = 0; i < sdpLines.length; i++) {
//    if (sdpLines[i].search('a=fmtp') !== -1) {
//      var payload = extractSdp(sdpLines[i], /a=fmtp:(\d+)/ );
//      if (payload === opusPayload) {
//        var fmtpLineIndex = i;
//        break;
//      }
//    }
//  }
//  // No fmtp line found.
//  if (fmtpLineIndex === null)
//    return sdp;
//
//  // Append stereo=1 to fmtp line.
//  sdpLines[fmtpLineIndex] = sdpLines[fmtpLineIndex].concat(' stereo=1');
//
//  sdp = sdpLines.join('\r\n');
//  return sdp;
//}

function extractSdp(sdpLine, pattern) {
  var result = sdpLine.match(pattern);
  return (result && result.length == 2)? result[1]: null;
}

// Set the selected codec to the first in m line.
function setDefaultCodec(mLine, payload) {
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
}

// Strip CN from sdp before CN constraints is ready.
function removeCN(sdpLines, mLineIndex) {
  var mLineElements = sdpLines[mLineIndex].split(' ');
  // Scan from end for the convenience of removing an item.
  for (var i = sdpLines.length-1; i >= 0; i--) {
    var payload = extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
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
}

// Send BYE on refreshing(or leaving) a demo page
// to ensure the room is cleaned for next session.
window.onbeforeunload = function() {
	send_message(room_id, client_id, 'bye', "{'type':'bye'}");
}

//// Set the video diplaying in the center of window.
//window.onresize = function(){
//  var aspectRatio;
//  if (remoteVideo.style.opacity === '1') {
//    aspectRatio = remoteVideo.videoWidth/remoteVideo.videoHeight;
//  } else if (localVideo.style.opacity === '1') {
//    aspectRatio = localVideo.videoWidth/localVideo.videoHeight;
//  } else {
//    return;
//  }
//
//  var innerHeight = this.innerHeight;
//  var innerWidth = this.innerWidth;
//  var videoWidth = innerWidth < aspectRatio * window.innerHeight ?
//                   innerWidth : aspectRatio * window.innerHeight;
//  var videoHeight = innerHeight < window.innerWidth / aspectRatio ?
//                    innerHeight : window.innerWidth / aspectRatio;
//  containerDiv = document.getElementById('container');
//  containerDiv.style.width = videoWidth + 'px';
//  containerDiv.style.height = videoHeight + 'px';
//  containerDiv.style.left = (innerWidth - videoWidth) / 2 + 'px';
//  containerDiv.style.top = (innerHeight - videoHeight) / 2 + 'px';
//};
