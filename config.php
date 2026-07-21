<?php
require 'vendor/autoload.php';

use League\OAuth2\Client\Provider\GenericProvider;
use Dotenv\Dotenv;

// Check if .env file exists
if ( ! file_exists( __DIR__ . '/.env' ) ) {
	die('Virhe: <code>.env</code>-tiedosto puuttuu. Luo tiedosto ja täytä asetukset.');
}

// Load environment variables
$dotenv = Dotenv::createImmutable( __DIR__ );

try {
	$dotenv->load();
} catch (Exception $e) {
	die('Virhe ladattaessa <code>.env</code>-tiedostoa. Tarkista tiedoston syntaksi ja sisältö.');
}

// Check for required variables
$requiredVariables = ['CLIENT_ID', 'CLIENT_SECRET', 'STATION_MAC', 'LATITUDE', 'LONGITUDE', 'ALTITUDE'];
$missingVariables = [];

foreach ($requiredVariables as $var) {
	if ( empty( $_ENV[ $var ] ) ) {
			$missingVariables[] = $var;
	}
}

if ( ! empty( $missingVariables ) ) {
   die( 'Virhe: Seuraavat muuttujat puuttuvat <code>.env</code>-tiedostosta: ' . implode( ', ', $missingVariables ) );
}

// Configuration from .env
$client_id = $_ENV['CLIENT_ID'];
$client_secret = $_ENV['CLIENT_SECRET'];

// Check if the script is running in a subdirectory
$subdirectory = dirname( $_SERVER['PHP_SELF'] );
if ( ! empty( $subdirectory ) ) {
	$subdirectory = rtrim( $subdirectory, '/' );
} else {
	$subdirectory = '';
}

// Dynamically determine the redirect URI.
$is_https = (
	( isset( $_SERVER['HTTPS'] ) && $_SERVER['HTTPS'] !== 'off' ) ||
	( isset( $_SERVER['SERVER_PORT'] ) && (int) $_SERVER['SERVER_PORT'] === 443 ) ||
	( isset( $_SERVER['HTTP_X_FORWARDED_PROTO'] ) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https' )
);

$scheme = $is_https ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'] ?? '127.0.0.1';
$redirect_uri = $scheme . '://' . $host . $subdirectory . '/auth.php';

$provider = new GenericProvider([
    'clientId'                => $client_id,
    'clientSecret'            => $client_secret,
    'redirectUri'             => $redirect_uri,
    'urlAuthorize'            => 'https://api.netatmo.com/oauth2/authorize',
    'urlAccessToken'          => 'https://api.netatmo.com/oauth2/token',
    'urlResourceOwnerDetails' => '' // Not used
]);
