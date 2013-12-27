<?php
	include "db.php";

	function get_mysql_time() {
		$db_link = db_connect();
		$result = mysqli_query($db_link, "SELECT NOW();");
		if($result) {
			$row = mysqli_fetch_row($result);
			$date = $row[0];
			return $date;
		} else {
			return "error!";
		}
	}

	function new_room($client_id) {
		# get a new unique room name -- todo: there is possible read-write
		# race condition, but for now I don't care
		$candidate_room = random_name(6, "room");
		$i = 0;
		while(!is_room_unique($candidate_room) && $i<10) {
			$candidate_room = random_name(6, "room");
			$i += 1;
		} 
		if($i == 10) {
			echo "failed to find a room... Maybe system is full";
			return false;
		}

		$db_link = db_connect();
		$insert_query = "INSERT INTO rooms SET room_id='$candidate_room'";
		$insert_query .= ", initiator_id='$client_id';";
		$success = mysqli_query($db_link, $insert_query);
		if(!success) {
			echo 'Error creating room in DB!';
			return false;
		}

		return $candidate_room;
	}


	function new_client_id() {
		$candidate_id = random_name(6, "client");
		$i = 0;
		while(!is_client_unique($candidate_id) && $i<10) {
			$candidate_id = random_name(6, "client");
			$i += 1;
		} 
		if($i == 10) {
			echo "failed to find a client id... Maybe system is full";
			return false;
		}

		$ip = $_SERVER['REMOTE_ADDR'];

		$db_link = db_connect();
		$insert_query = "INSERT INTO clients SET client_id='$candidate_id'";
		$insert_query .= ", ip='$ip';";

		$success = mysqli_query($db_link, $insert_query);
		if(!success) {
			echo 'Error creating client in DB!';
			return false;
		}

		return $candidate_id;
	}


	function random_name($length, $salt) {
		$long_str = sha1($salt . round(microtime(true) * 1000));
		$short_str = substr($long_str, 0, $length);
		return $short_str;
	}


	function is_room_unique($candidate_room) {
		$db_link = db_connect();
		$query = "SELECT * FROM rooms WHERE room_id = '$candidate_room'";
		$result = mysqli_query($db_link, $query);
		$num_rows = mysqli_num_rows($result);

		if($num_rows) {
			return false;
		} else {
			return true;
		}
	}

	function is_client_unique($candidate_id) {
		$db_link = db_connect();
		$query = "SELECT * FROM clients WHERE client_id = '$candidate_id'";
		$result = mysqli_query($db_link, $query);
		$num_rows = mysqli_num_rows($result);

		if($num_rows) {
			return false;
		} else {
			return true;
		}
	}

	function post($room, $client_id, $type, $message) {
		$query = "INSERT INTO signals SET room_id='$room'";
		$query .= ", client_id='$client_id', type='$type'";
		$query .= ", message=\"$message\";";

		$db_link = db_connect();
		$result = mysqli_query($db_link, $query);
		$error = mysqli_error($db_link);
		echo $error;
	}


	function poll($room, $client_id, $type, $last_msg_timestamp) {
		$query = "SELECT * FROM signals WHERE room_id='$room' ";
		$query .= " AND client_id<>'$client_id'";
		$query .= " AND `timestamp`>='$last_msg_timestamp'";
		if($type != '') {
			$query .= "	AND type<>$type";
		}
		$query .= " ORDER BY signal_id ASC";

		$db_link = db_connect();
		$result = mysqli_query($db_link, $query);
		$error = mysqli_error($db_link);

		if($error) {
			echo $error;
		} else if(mysqli_num_rows($result)){
			echo result2json($result);
		} else {
			echo '([])';
		}
	}

	function result2json($result) {
		$array_literal = '([';
		$row_sep = '';
		while($row = mysqli_fetch_assoc($result)) {
			$array_literal .= $row_sep . '{';
			$sep = '';
			foreach($row as $field_name => $value) {
				$array_literal .= "$sep '$field_name': ";
				if(is_string($value)) {
					$value = js_escape($value);
					$array_literal .= "'$value'";
				} else if(is_null($value)) {
					$array_literal .= "null";
				} else if(is_numeric($value)) {
					$array_literal .= $value;
				}
				$sep = ',';
			}
			$array_literal .= '}';
			$row_sep = ',';
		}
		$array_literal .= '])';
		return $array_literal;
	}

	function js_escape($str) {
		return addcslashes($str, "\\'");
	}

	function is_client_in_room($room, $client_id) {
	}

	function ensure_room_exists($room_id, $client_id) {
		$db_link = db_connect();
		$query = "INSERT IGNORE INTO rooms SET room_id='$room_id'";
		$query .= ", initiator_id='$client_id';";
		$result = mysqli_query($db_link, $query);
		$error =  mysqli_error($db_link);
		if($error) {
			echo $error;
		}
	}

	function get_initiator($room_id) {
		$db_link = db_connect();
		$query = "SELECT * FROM rooms WHERE room_id='$room_id'";
		$result = mysqli_query($db_link, $query);
		$error = mysqli_error($db_link);
		if($error) {
			echo $error;
			return null;
		} else if(!mysqli_num_rows($result)) {
			return null;
		}
				
		$row = mysqli_fetch_assoc($result);
		return $row['initiator_id'];
	}


	function join_room($room, $client_id) {
		$msg = "$client_id joined";
		post($room, $client_id, "join", $msg);
	}
?>


