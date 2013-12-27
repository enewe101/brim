<?php

	include 'signalling.php';

	$room_id = $_POST['room_id'];
	$client_id = $_POST['client_id'];
	$last_msg_timestamp = $_POST['last_msg_timestamp'];

	$new_msgs = poll($room_id, $client_id, $type, $last_msg_timestamp);
?>
