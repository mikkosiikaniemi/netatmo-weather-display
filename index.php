<?php

/**
 * A weather display web application for presenting temperature information
 * gathered by locally installed Netatmo weather sensors.
 *
 * @author Mikko Siikaniemi / Mikrogramma Design
 * @link https://github.com/mikkosiikaniemi/netatmo-weather-display
 */

require 'vendor/autoload.php';

// Start a PHP session to store the Netatmo API access token and such.
session_start();

// Set the correct timezone in order to print correctly formatted time
date_default_timezone_set( 'Europe/Helsinki' );
setlocale( LC_TIME, 'fi' );

// Check if the obligatory configuration file exists.
if ( false === file_exists( 'config.php' ) ) {
	die( 'Konfiguraatiotiedostoa ei ole olemassa.' );
} else {
	// Initialize helper functions
	require_once 'netatmo.php';
}

// If user chose to log out
if ( isset( $_POST['logout'] ) ) {
	logout_netatmo();
}

global $provider;

$provider = new \Rugaard\OAuth2\Client\Netatmo\Provider\Netatmo(
	array(
		'clientId'     => CLIENT_ID,
		'clientSecret' => CLIENT_SECRET,
		'redirectUri'  => LOCAL_URL,
	)
);


// If there is no authorization code from Netatmo, or if the session has not been started
if ( ! isset( $_GET['code'] ) || ! isset( $_SESSION ) ) {
	login_netatmo();
}

if ( isset( $_SESSION['state'] ) ) {

	if ( ! isset( $_SESSION['access_token'] ) ) {
		get_access_token();
	}

	if ( isset( $_SESSION['token_expires'] ) && time() > $_SESSION['token_expires'] ) {
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

	<div id="date-and-time" class="date-and-time padded">
		<span id="date">Haetaan päiväystä...</span>
		<div id="actions">
			<button id="refresh" aria-label="Päivitä">
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="icon-stroked feather feather-refresh-cw" viewBox="0 0 24 24">
					<path d="M23 4v6h-6M1 20v-6h6"/>
					<path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15"/>
				</svg>
			</button>
			<button id="dark-mode" aria-label="Tumma/vaalea tila">
				<svg xmlns="http://www.w3.org/2000/svg" data-class="dark-mode" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="icon-stroked feather feather-sun" viewBox="0 0 24 24">
					<circle cx="12" cy="12" r="5"/>
					<path d="M12 1v2m0 18v2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M1 12h2m18 0h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>
				</svg>
				<svg xmlns="http://www.w3.org/2000/svg" data-class="light-mode" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="icon-stroked feather feather-moon" viewBox="0 0 24 24" style="display: none;">
  				<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>
				</svg>
			</button>
			<form action="<?php echo basename( $_SERVER['PHP_SELF'] ); ?>" method="post">
				<input type="hidden" name="logout" value="true" />
				<button type="submit" aria-label="Kirjaudu ulos">
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="icon-stroked feather feather-log-out" viewBox="0 0 24 24">
						<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9"/>
					</svg>
				</button>
			</form>
		</div>
		<span id="time">...</span>
	</div>

	<div class="update-timer">
		<div class="update-timer__bar"></div>
	</div>

	<div class="sunrise-sunset">
		<?php
			$sun_info        = date_sun_info( time(), LATITUDE, LONGITUDE );
			$sunrise         = $sun_info['sunrise'];
			$sunset          = $sun_info['sunset'];
			$sunrise_minutes = date( 'H', $sunrise ) * 60 + date( 'i', $sunrise );
			$sunset_minutes  = date( 'H', $sunset ) * 60 + date( 'i', $sunset );
			$sunrise_percent = round( ( $sunrise_minutes / ( 24 * 60 ) ) * 100, 2 );
			$sunset_percent  = round( ( $sunset_minutes / ( 24 * 60 ) ) * 100, 2 );
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
