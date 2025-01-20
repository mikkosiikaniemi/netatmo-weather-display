<?php
require_once 'config.php';
require_once 'functions.php';

// Check if the access token is available in the session

// Make a copy of $_SESSION data. Unset forecast params.
$session = $_SESSION;
unset( $session['forecast'] );
unset( $session['forecast_expires'] );
error_log( print_r( $session, true ) );

if ( ! isset( $_SESSION['access_token'] ) ) {
	error_log( 'Access token not set, login required. Dying.' );
  die( 'Ole hyvä ja <a href="auth.php">kirjaudu sisään</a>.' );
}

// Create the access token object
$accessToken = new \League\OAuth2\Client\Token\AccessToken([
	'access_token' => $_SESSION['access_token'],
	'refresh_token' => $_SESSION['refresh_token'],
	'expires' => $_SESSION['expires_at']
]);

// Fetch the weather data from the Netatmo API
$weatherData = getWeatherData( $accessToken );

echo print_temperatures( $weatherData );

echo print_yr_forecast();
