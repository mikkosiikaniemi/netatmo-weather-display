<?php
require 'config.php';
require 'functions.php';

// Handle the OAuth callback and store the token
if (isset($_GET['code'])) {

	error_log( 'We have code, getting access token.');

	try {
		// Get the access token using the code from the callback
		$accessToken = $provider->getAccessToken('authorization_code', [
			'code' => $_GET['code']
		]);

		error_log( 'Save token to session.' );

		// Save the access token to the session
		saveTokensToSession($accessToken);

		error_log( 'Redirecting to index.php...' );

		// Redirect to the weather data page
		header('Location: index.php');
		exit;
	} catch (\League\OAuth2\Client\Provider\Exception\IdentityProviderException $e) {
		error_log( 'Error obtaining access token: ' . $e->getMessage() );
		die( 'Error obtaining access token: ' . $e->getMessage() );
	}
}

// Redirect to the Netatmo OAuth authorization page
if ( ! isset( $_SESSION['access_token'] ) ) {

	error_log( 'Get authorization URL.' );

	$authorizationUrl = $provider->getAuthorizationUrl([
		'scope' => 'read_station'
	]);

	error_log( 'Authorization URL: ' . $authorizationUrl );

	// Store the state for security checks
	$_SESSION['oauth2state'] = $provider->getState();

	error_log( 'Redirect to authorization URL.' );

	// Redirect the user to the authorization page
	header( 'Location: ' . $authorizationUrl );
	exit;
}

// Refresh the access token if needed
refreshAccessTokenIfNeeded( $provider );
