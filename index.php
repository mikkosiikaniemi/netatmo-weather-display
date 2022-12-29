<?php

/**
 * A weather display web application for presenting temperature information
 * gathered by locally installed Netatmo weather sensors.
 *
 * @author Mikko Siikaniemi / Mikrogramma Design
 * @link https://github.com/mikkosiikaniemi/netatmo-weather-display
 */

// Start a PHP session to store the Netatmo API access token and such.
session_start();

// Set the correct timezone in order to print correctly formatted time
date_default_timezone_set('Europe/Helsinki');
setlocale(LC_TIME, "fi");

// Check if the obligatory configuration file exists.
if ( false === file_exists( 'config.php' ) ) {
	die( 'Konfiguraatiotiedostoa ei ole olemassa.');
} else {
	// Initialize helper functions
	require_once 'netatmo.php';
}

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
	<title>Netatmo Sää</title>
	<meta name="viewport" content="width=device-width, initial-scale=1, minimal-ui">
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
	<link rel="stylesheet" href="netatmo.css?ver=<?php echo filemtime( 'netatmo.css' ); ?>">
	<link rel="shortcut icon" href="apple-touch-icon.png" />
</head>

<body class="dark-mode">

	<?php include_once 'svg-symbols.svg'; ?>

	<p id="date-and-time" class="date-and-time padded">Haetaan päiväystä...</p>

	<div class="update-timer">
		<div class="update-timer__bar"></div>
	</div>

	<div class="sunrise-sunset">
		<?php
			$sunrise = date_sunrise( time(), SUNFUNCS_RET_TIMESTAMP, LATITUDE, LONGITUDE, 90 );
			$sunset  = date_sunset( time(), SUNFUNCS_RET_TIMESTAMP, LATITUDE, LONGITUDE, 90 );
			$sunrise_minutes = date( 'H', $sunrise ) * 60 + date( 'i', $sunrise );
			$sunset_minutes = date( 'H', $sunset ) * 60 + date( 'i', $sunset );
			$sunrise_percent = round( ( $sunrise_minutes / ( 24 * 60 ) ) * 100, 2 );
			$sunset_percent = round( ( $sunset_minutes / ( 24 * 60 ) ) * 100, 2 );
		?>
		<div class="sunrise" style="left: <?php echo $sunrise_percent; ?>%;">
			<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"   stroke-linecap="round" stroke-linejoin="round" class="icon-stroked feather feather-sunrise"><path d="M17 18a5 5 0 0 0-10 0"></path><line x1="12" y1="2" x2="12" y2="9"></line><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"></line><line x1="1" y1="18" x2="3" y2="18"></line><line x1="21" y1="18" x2="23" y2="18"></line><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"></line><line x1="23" y1="22" x2="1" y2="22"></line><polyline points="8 6 12 2 16 6"></polyline></svg>
			<span class=""><?php echo date( 'H:i', $sunrise ); ?></span>
		</div>
		<div class="sunset" style="left: <?php echo $sunset_percent; ?>%;">
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="icon-stroked feather feather-sunset"><path d="M17 18a5 5 0 0 0-10 0"></path><line x1="12" y1="9" x2="12" y2="2"></line><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"></line><line x1="1" y1="18" x2="3" y2="18"></line><line x1="21" y1="18" x2="23" y2="18"></line><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"></line><line x1="23" y1="22" x2="1" y2="22"></line><polyline points="16 5 12 9 8 5"></polyline></svg>
				<span class=""><?php echo date( 'H:i', $sunset ); ?></span>
		</div>
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
