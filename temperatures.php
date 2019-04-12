<?php
include_once 'netatmo.php';

try {
	echo print_temperatures();
}
catch ( Exception $e ) {
	echo $e->getMessage();
}
