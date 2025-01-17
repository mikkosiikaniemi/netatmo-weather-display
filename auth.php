<?php
require 'config.php';
require 'functions.php';

// Handle the OAuth callback and store the token
if (isset($_GET['code'])) {
    try {
        // Get the access token using the code from the callback
        $accessToken = $provider->getAccessToken('authorization_code', [
            'code' => $_GET['code']
        ]);

        // Save the access token to the session
        saveTokensToSession($accessToken);

        // Redirect to the weather data page
        header('Location: index.php');
        exit;
    } catch (\League\OAuth2\Client\Provider\Exception\IdentityProviderException $e) {
        die('Error obtaining access token: ' . $e->getMessage());
    }
}

// Redirect to the Netatmo OAuth authorization page
if (!isset($_SESSION['access_token'])) {
    $authorizationUrl = $provider->getAuthorizationUrl([
        'scope' => 'read_station'
    ]);

    // Store the state for security checks
    $_SESSION['oauth2state'] = $provider->getState();

    // Redirect the user to the authorization page
    header('Location: ' . $authorizationUrl);
    exit;
}

// Refresh the access token if needed
refreshAccessTokenIfNeeded($provider);
