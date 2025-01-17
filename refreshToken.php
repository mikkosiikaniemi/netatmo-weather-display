<?php
require_once 'config.php';
require_once 'functions.php';

if (!isset($_SESSION['refresh_token'])) {
	echo json_encode(['error' => 'User not authenticated']);
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

if (refreshAccessTokenIfNeeded($provider)) {
  echo json_encode(['expires_at' => $_SESSION['expires_at']]);
} else {
  echo json_encode(['error' => 'Failed to refresh token']);
}
