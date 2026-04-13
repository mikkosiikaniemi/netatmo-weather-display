<?php
error_log( 'Logging out.' );
session_start();
session_unset();
session_destroy();
header('Location: index.php');
exit;
