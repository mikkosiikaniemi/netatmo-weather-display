<?php
require_once 'config.php';
require_once 'functions.php';

if ( ! isset($_SESSION['refresh_token'] ) ) {
	error_log( 'Refresh token not set.' );
	echo json_encode( ['error' => 'User not authenticated'] );
	exit;
}

// Refresh the token if needed
$provider = new League\OAuth2\Client\Provider\GenericProvider([
	'clientId'                => $client_id,
	'clientSecret'            => $client_secret,
	'redirectUri'             => $redirect_uri,
	'urlAuthorize'            => 'https://api.netatmo.com/oauth2/authorize',
	'urlAccessToken'          => 'https://api.netatmo.com/oauth2/token',
	'urlResourceOwnerDetails' => 'https://api.netatmo.com/api/getstationsdata'
]);

if ( refreshAccessTokenIfNeeded( $provider ) ) {
	error_log( 'Access token refreshed, set new expiration.' );
  echo json_encode( ['expires_at' => $_SESSION['expires_at']] );
} else {
	error_log( 'Failed to refresh access token.' );
  echo json_encode( ['error' => 'Failed to refresh token'] );
}
