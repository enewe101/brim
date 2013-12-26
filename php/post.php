<?php

	include 'signalling.php';
	$db_link = db_connect();

	$room_id = $_POST['room_id'];
	$client_id = $_POST['client_id'];
	$type = $_POST['type'];
	$message = $_POST['message'];

	// Escape.  Takes a db_link, which it uses to know what the db's 
	// character encoding is to do proper escapage.
	$message = mysqli_real_escape_string($db_link, $message);

	post($room_id, $client_id, $type, $message);
?>
