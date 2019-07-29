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
setlocale(LC_TIME, "fi");

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

//mikrogramma_debug( $_SESSION );
//mikrogramma_debug( $_GET );

// If user chose to log out
if ( isset( $_POST['logout'] ) ) {
	logout_netatmo();
}

// If there is no authorization code from Netatmo, or if the session has not been started
if ( ! isset( $_GET['code'] ) || ! isset( $_SESSION ) ) {
//if ( ! isset( $_SESSION['state'] ) ) {
	login_netatmo();
}

if ( isset( $_SESSION['state'] ) ) {//&& ( $_SESSION['state'] === $_GET['state'] ) ) {

	if ( ! isset( $_SESSION['access_token'] ) ) {
		get_access_token();
	}

	if( isset( $_SESSION['token_expires'] ) && time() > $_SESSION['token_expires'] ) {
		refresh_token();
	}

} else {
	echo '<p>Istunnon tila ei täsmää. <a href="' . basename( $_SERVER['PHP_SELF'] ) . '">Kirjaudu uudelleen.</a></p>';
	?>
	<script>
	setTimeout( "location.href = '<?php echo basename( $_SERVER['PHP_SELF'] ); ?>';",3000);
	</script>
	<?php
	die();
}

?>
<!doctype html>
<html lang="fi">

<head>
	<meta charset="utf-8">
	<meta http-equiv="x-ua-compatible" content="ie=edge">
	<title>Ukkoherranlenkki 4 Netatmo</title>
	<meta name="viewport" content="width=device-width, initial-scale=1, minimal-ui">
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
	<link rel="stylesheet" href="netatmo.css?ver=<?php echo filemtime( 'netatmo.css' ); ?>">
</head>

<body class="dark-mode">

	<p id="date-and-time" class="date-and-time">Haetaan päiväystä...</p>

	<div class="update-timer">
		<div class="update-timer__bar"></div>
	</div>

	<div id="temperatures-and-forecast">
		<?php	echo print_temperatures(); ?>
	</div>

	<div id="actions" class="padded">
		<button id="refresh">Päivitä</button>
		<form action="<?php echo basename( $_SERVER['PHP_SELF'] ); ?>" method="post">
			<input type="hidden" name="logout" value="true" />
			<button type="submit">Kirjaudu ulos</button>
		</form>
	</div>

	<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/1.8.3/jquery.min.js" integrity="sha256-YcbK69I5IXQftf/mYD8WY0/KmEDCv1asggHpJk1trM8=" crossorigin="anonymous"></script>
	<script src="https://cdnjs.cloudflare.com/ajax/libs/flot/0.8.3/jquery.flot.min.js" integrity="sha256-LMe2LItsvOs1WDRhgNXulB8wFpq885Pib0bnrjETvfI=" crossorigin="anonymous"></script>
	<script src="https://cdnjs.cloudflare.com/ajax/libs/flot/0.8.3/jquery.flot.time.min.js" integrity="sha256-gCrSjRo/Z6W7Cfc1oEL6BH8HKjgiiO+ItV8A+z9Scpw=" crossorigin="anonymous"></script>
	<script src="https://cdnjs.cloudflare.com/ajax/libs/flot/0.8.3/jquery.flot.resize.min.js" integrity="sha256-EM0o7Qv7O213xqRbn8IFc6QsSr02kAX1/z7musSfxx8=" crossorigin="anonymous"></script>
	<script src="https://cdnjs.cloudflare.com/ajax/libs/flot/0.8.3/jquery.flot.threshold.min.js" integrity="sha256-RgFycE5E183kX3Qvb9ogyMWG1Q/BaN1StpWF2sChHJw=" crossorigin="anonymous"></script>
	<script>
		var netatmo = {
			update_interval: <?php echo NETATMO_UPDATE_INTERVAL; ?>
		};
	</script>
	<script src="netatmo.js?ver=<?php echo filemtime( 'netatmo.js' ); ?>"></script>
</body>
</html>
