<?php
	function db_connect() {
		$con = mysqli_connect('localhost', 'uedwardn_root', 'integr8', 'uedwardn_signal');
		if(mysqli_connect_errno($con)) {
			echo 'Failed to connect to MySql';
		}
		return $con;
	}
?>
