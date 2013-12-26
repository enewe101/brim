<?php
	
	// Open a connection to the database
	include 'db.php';
	$con = db_connect();

	// Globals for this script
	$MAX_SIZE_MB = 4;	// Max allowed file size in megabytes
	$FORM_KEYS = array('fname', 'lname', 'email', 'affiliation', 'presentation', 'workshop_duration', 'abstract', 'redhair');
	$OPEN_SCRIPT = "<script type='text/javascript'>";
	$CLOSE_SCRIPT = "</script>";
	$REPLY_VAR = "submission_reply";

	// Get all the posted form data that we expect.
	$form_data = array();
	foreach($FORM_KEYS as $key){
		$form_data[$key] = $_POST[$key];
	}

	// We also store the IP address from which this data was sent.
	$form_data['ip'] = $_SERVER['REMOTE_ADDR'];


	// TODO: Should we check that this is a unique registration? 

	// If this is a registration for a workshop, we have to save the 
	// person's uploaded cv (it's a PDF).
	if($form_data['presentation'] == 'workshop') {
		// Check for errors
		if($_FILES['cv_file']['error']) {
			$reply = "'success': false";
			$reply .= ", 'error': 'file upload error.'";
			$reply .= ", 'errno': " . $_FILES['cv_file']['error'];
			$reply = '{' . $reply . '}';
			echo "$OPEN_SCRIPT $REPLY_VAR = $reply; $CLOSE_SCRIPT";
			return;
		}

		// Check for compliant file size
		$size = $_FILES['cv_file']['size'] / (1024*1024);
		if($size > $MAX_SIZE_MB) {
			$reply = "'success': false";
			$reply .= ", 'error': 'file too large'";
			$reply .= ", 'errno': " . $size;
			$reply = '{' . $reply . '}';
			echo "$OPEN_SCRIPT $REPLY_VAR = $reply; $CLOSE_SCRIPT";
			return;
		}

		// If the redherring field was filled, don't save the spam file.
		// Otherwise go ahead and move it to a permanent location.
		if($redhair == '') {

			// Name the file based on user's real name
			$destination = dirname(__FILE__) . '/polnet_cvs/';
			$destination .= $form_data['fname'] . '.' . $form_data['lname'];

			// To avoid collision, in case user has non-unique first/last 
			// tack on a bit of the hash of system time.
			$no_collide = substr(sha1(time()), 0, 6);
			$destination .= '.' . $no_collide . '.pdf';

			// Move the file to its storage directory.
			move_uploaded_file($_FILES['cv_file']['tmp_name'], $destination);
			$form_data['cv_file'] = $destination;
		}
	}

	// Prepare data for safe insertion into db. Escape and enquote strings
	foreach ($form_data as $key => $value) {
		$form_data[$key] = mysqli_real_escape_string($con, $form_data[$key]);
		$form_data[$key] = "'" . $form_data[$key] . "'";
	}

	// We'll now set some values NULL.  We only need workshop_duration and 
	// filename for user's CV if the user registered to give a workshop.
	if($form_data['presentation'] != "'workshop'") {
		$form_data['workshop_duration'] = 'NULL';
		$form_data['cv_file'] = 'NULL';
	}

	// And if the user is not presenting a talk, poster, or workshop, we don't 
	// need to store anything for the abstract.
	if($form_data['presentation'] == "'attend'") {
		$form_data['abstract'] = 'NULL';
	}

	// Prepare the sql statement.  First put together fieldnames and values.
	$sql_values = '';
	$sql_fieldnames = '';
	$separator = '';
	foreach($form_data as $key => $val) {
		$sql_fieldnames .= $separator . "`" . $key . "`";
		$sql_values .= $separator . $val;
		$separator = ',';
	}

	// Now bring together the full sql statement.
	$sql = "INSERT INTO registrants ($sql_fieldnames) VALUES ($sql_values);";

	// Perform the insertion into the database.  Make sure it was successful.
	$success = mysqli_query($con, $sql);
	if(!$success) {
		$clean_error = str_replace("'", "\\'", mysqli_error($con));
		$reply = "'success': false";
		$reply .= ", 'errno': " . mysqli_errno($con);
		$reply .= ", 'error': '" . $clean_error . "'";
		$reply = '{' . $reply . '}';
		echo "$OPEN_SCRIPT $REPLY_VAR = $reply; $CLOSE_SCRIPT";
		return;
	}

	// Provide feedback to the client javascript.  
	// The client can warn the user if there was an error.
	$reply = "'success': true, 'error': null, 'errno': null";
	$reply = '{' . $reply . '}';
	echo "$OPEN_SCRIPT $REPLY_VAR = $reply; $CLOSE_SCRIPT";

