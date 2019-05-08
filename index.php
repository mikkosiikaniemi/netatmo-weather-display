<?php
/**
 * A weather display web application for presenting temperature information
 * gathered by locally installed Netatmo weather sensors.
 *
 * @author Mikko Siikaniemi / Mikrogramma Design
 * @link https://bitbucket.org/MikrogrammaDesign/netatmo
 */

// Start a PHP session to store the Netatmo API access token and such.
session_start();

// Set the correct timezone in order to print correctly formatted time
date_default_timezone_set('Europe/Helsinki');

/**
 * Check if the obligatory configuration file exists.
 * You can get the ID and secret after creating an app at
 * https://dev.netatmo.com/myaccount/createanapp
 *
 * // Client ID and secret
 * $client_id     = '';
 * $client_secret = '';
 *
 * // Define the local redirect URL
 * $local_url = '';
 *
 * // Netatmo main module (station) MAC address
 * $station_mac = '';
 */
if ( false === file_exists( 'config.php' ) ) {
	die( 'Konfiguraatiotiedostoa ei ole olemassa.');
} else {
	// Initialize helper functions
	require_once 'netatmo.php';
}
?>
<!doctype html>
<html lang="fi">

<head>
	<meta charset="utf-8">
	<meta http-equiv="x-ua-compatible" content="ie=edge">
	<title>Ukkoherranlenkki 4 Netatmo</title>
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="apple-mobile-web-app-capable" content="yes">
	<link rel="apple-touch-icon" href="apple-touch-icon.png">
	<style>
		html, body {
			height: 100%;
			border: 0;
			background: #000;
		}
		body {
			margin: 0;
		}
		iframe {
			border: 0;
			width: 100%;
			height: 100%;
		}
	</style>
</head>

<body>
	<?php //mikrogramma_debug( $_SESSION ); mikrogramma_debug( $local_url ); ?>
	<?php if( isset( $_SESSION['code']) && isset( $_SESSION['state'] ) ) : ?>
	<iframe src="iframe.php?state=<?php echo $_SESSION['state']; ?>&code=<?php echo $_SESSION['code']; ?>"></iframe>
	<?php else : ?>
	<iframe src="iframe.php"></iframe>
	<?php endif; ?>
</body>
</html>
