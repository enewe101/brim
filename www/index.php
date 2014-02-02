<?php
	include 'php/signalling.php';
	
	// Client gets it's client id;
	$client_id = new_client_id();
	$join_timestamp = get_mysql_time();

	// Client joins a room.  The room could be specified in the url otherwise
	// a random room is made.
	if(isset($_GET['room_id'])) {
		$room_id = $_GET['room_id'];
		if(strlen($room_id) != 6) {
			$error = "Error! invalid room";
		} else {
			ensure_room_exists($room_id, $client_id);
		}

	} else {
		$room_id = new_room($client_id);
	}

	// Join the room.  A join room signal will be broadcast by the server on
	// the client's behalf, even before the signaller is built on the client.
	// Maybe you want to let client send join message with her signaller
	join_room($room_id, $client_id);
	$initiator_id = get_initiator($room_id);

	// The initiator of the room is passive, and waits for newcommers to 
	// initiate.  Hence, the room initiator is never the call-initiator!
	$initiator = $initiator_id == $client_id? 'false' : 'true';
	$is_first = $initiator_id == $client_id? 'true' : 'false';

	// Generate a url for this room.  Users might share by email or IM to 
	// get connected
	$room_file_url = 'http://'.$_SERVER['HTTP_HOST'].$_SERVER['PHP_SELF'];
	$room_id_url = "?room_id=$room_id";
	$room_url = $room_file_url . $room_id_url;

?>
<html>

<head>
	<meta name="viewport" 
	content="width=device-width, initial-scale=1.0, minimum-scale=1.0">
	<meta http-equiv="X-UA-Compatible" content="chrome=1" />
	<base target="_blank">
	<title>getUserMedia</title>
	<link rel="stylesheet" href="css/main.css" />
	<script type='text/javascript' src='../../common/js/jquery.js'>
	<script type="text/javascript" src="js/clips_lib.js"></script>
	<script type="text/javascript" src="js/adapter.js"></script>
	<script type="text/javascript" src="js/signal.js"></script>
	<script type="text/javascript">

		// This passes php-computed values on the server to the client js
		var room_id = '<?php echo $room_id; ?>';
		var client_id = '<?php echo $client_id; ?>';
		var initiator = <?php echo $initiator; ?>;
		var is_first = <?php echo $is_first; ?>;
		var join_timestamp = '<?php echo $join_timestamp; ?>';
		var last_msg_timestamp = join_timestamp;
		var last_signal_id = null;

	</script>
	<script type="text/javascript" src="js/rtc.js"></script>
	<script type="text/javascript" src="js/paper.js"></script>
	<script type="text/javascript" src="js/whiteboard.js"></script>
	<script type="text/javascript" src="js/onload.js"></script>
</head>

<body onload='init()'>
<a href='<?php echo $room_url;?>'><?php echo $room_url;?></a>
	<div id='col1'>
		<div id='messengers'>
			<textarea id="dataChannelSend" disabled></textarea>
			<textarea id="dataChannelReceive" disabled></textarea>

			<div id="buttons">
			  <button id="startButton">Start</button>
			  <button id="sendButton">Send</button>
			  <button id="closeButton">Stop</button>
			  <button id="aux">Aux</button>
			</div>
		</div>
		<div id='whiteboard_target'>
		<!--canvas id='whiteboard'></canvas-->
		<a id='pencil_button'>Pencil</a>
		<a id='cloud_button'>Clouds</a>
		</div>
	</div>
	<div id='col2'>
		<div id='chats'>
			<video id='local_video' autoplay muted='true'></video>
			<video id='remote_video' autoplay></video>
		</div>
		<div id='signaller'>
			<div id='room_id'>Room ID: <?php echo $room_id; ?> </div>
			<div id='initiator_id'>Room created by: <?php echo $initiator_id; ?> 
			</div>
			<div id='client_id'>Client ID: <?php echo $client_id; ?> </div>
			<div id='join_time'>Joined at: <?php echo $join_timestamp; ?> </div>
			<div id='message_pane'></div>
			<input id='message_input' type='text' />
		</div>
	</div>
</body>

</html>
