<?php
	include 'php/signalling.php';
	$errors = Array();
	$client_id = new_client_id();
	$join_timestamp = get_mysql_time();

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

	join_room($room_id, $client_id);
	$initiator_id = get_initiator($room_id);
?>
<html>

<head>
	<meta name="viewport" 
	content="width=device-width, initial-scale=1.0, minimum-scale=1.0">
	<meta http-equiv="X-UA-Compatible" content="chrome=1" />
	<base target="_blank">
	<title>getUserMedia</title>
	<link rel="stylesheet" href="css/main.css" />
	<script type="text/javascript" src="js/prototype.js"></script>
	<script type="text/javascript" src="js/signal.js"></script>
	<script type="text/javascript">
		var room_id = '<?php echo $room_id; ?>';
		var client_id = '<?php echo $client_id; ?>';
		var join_timestamp = '<?php echo $join_timestamp; ?>';
		var last_msg_timestamp = join_timestamp;
		var last_signal_id = null;
	</script>
	<style>
		video {
			height: 540px;
			width: 200px;
		}

		#message_pane {
			border: solid 1px black;
			height: 400px;
			width: 300px;
			overflow: scroll;
		}

		#message_input {
			width: 300px;
		}

		.green {
			color: green;
		}
		.blue {
			color: blue;
		}
		.bold {
			font-weight: bold;
		}
	</style>
</head>

<body onload='init()'>
	<div id='room_id'>Room ID: <?php echo $room_id; ?> </div>
	<div id='initiator_id'>Room created by: <?php echo $initiator_id; ?> </div>
	<div id='client_id'>Client ID: <?php echo $client_id; ?> </div>
	<div id='join_time'>Joined at: <?php echo $join_timestamp; ?> </div>
	<div id='message_pane'>
	</div>
	<input id='message_input' type='text' />
	<input id='poll_button' type='button' value='poll' />
</body>

</html>
