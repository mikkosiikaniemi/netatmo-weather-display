<?php
if ( isset( $_POST['logout'] ) ) {
	logout_netatmo();
}
?>
<!doctype html>
<html class="no-js" lang="">

<head>
	<meta charset="utf-8">
	<meta http-equiv="x-ua-compatible" content="ie=edge">
	<title>Ukkoherranlenkki 4 Netatmo</title>
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<link rel="stylesheet" href="netatmo.css">
</head>

<body>

<div id="timer">Haetaan päiväystä...</div>

<?php
	session_start();

if ( ! isset( $_GET['code'] ) || ! isset( $_SESSION ) ) {
	login_netatmo();
}

if ( isset( $_SESSION['state'] ) && ( $_SESSION['state'] === $_GET['state'] ) ) {

	if ( ! isset( $_SESSION['access_token'] ) ) {
		get_access_token();
	}

	if( time() > $_SESSION['token_expires'] ) {
		refresh_token();
	}

	mikrogramma_debug( $_SESSION );

	$api_url = 'https://api.netatmo.com/api/getstationsdata?access_token='
	. $_SESSION['access_token'];

	$remote_data = @file_get_contents( $api_url );
	$stations    = json_decode( $remote_data );

	if ( null !== $stations ) {
		//mikrogramma_debug( $stations );

		// Take only the first station's info
		$station = $stations->body->devices[0];

		// Print the main module info
		echo $station->module_name . ': ' . $station->dashboard_data->Temperature . ' &mdash; ' . date( 'j.n.Y H:i:s', $station->dashboard_data->time_utc ) . '<br/>';

		// Print the info for each submodule
		foreach ( $station->modules as $module ) {
			echo $module->module_name . ': ' . $module->dashboard_data->Temperature . ' &mdash; ' . date( 'j.n.Y H:i:s', $module->dashboard_data->time_utc ) . '<br/>';
		}

		// Print session expiry info
		echo 'Istunto vanhenee ' . date( 'j.n.Y H:i:s',  $_SESSION['token_expires'] ) . '<br/>';
		echo '<form action="' . basename( $_SERVER['PHP_SELF'] ) . '" method="post">
		<input type="hidden" name="logout" value="true" /><button type="submit">Kirjaudu ulos</button></form>';
	} else {
		echo 'Istunto ei ole voimassa. <a href="' . basename( $_SERVER['PHP_SELF'] ) . '">Kirjaudu uudelleen.</a>';
	}
} else {
	mikrogramma_debug( $_SESSION );
	echo 'The state does not match. You may be a victim of CSRF. <a href="' . basename( $_SERVER['PHP_SELF'] ) . '">Kirjaudu uudelleen.</a>';
}

/**
 * Get access token
 */
function get_access_token() {

	// Read client credentials from a config file
	require_once 'Config.php';

	$code = $_GET['code'];

	$token_url = 'https://api.netatmo.com/oauth2/token';

	$postdata = http_build_query(
		array(
			'grant_type'    => 'authorization_code',
			'client_id'     => $client_id,
			'client_secret' => $client_secret,
			'code'          => $code,
			'redirect_uri'  => $local_url,
			'scope'         => 'read_station',
		)
	);

	$opts = array(
		'http' =>
		array(
			'method'  => 'POST',
			'header'  => 'Content-type: application/x-www-form-urlencoded;charset=UTF-8',
			'content' => $postdata,
		),
	);

	$context = stream_context_create( $opts );

	$response = file_get_contents( $token_url, false, $context );
	$params = null;
	$params = json_decode( $response, true );

	$_SESSION['access_token']   = $params['access_token'];
	$_SESSION['refresh_token']  = $params['refresh_token'];
	$_SESSION['token_lifetime'] = $params['expires_in'];
	$_SESSION['token_expires']  = time() + $params['expires_in'];
}

/**
 * Refresh the access token
 */
function refresh_token() {

	// Read client credentials from a config file
	require_once 'Config.php';

	$token_url = 'https://api.netatmo.com/oauth2/token';

	$postdata = http_build_query(
		array(
			'grant_type'    => 'refresh_token',
			'client_id'     => $client_id,
			'client_secret' => $client_secret,
			'refresh_token' => $_SESSION['refresh_token'],
		)
	);

	$opts = array(
		'http' =>
		array(
			'method'  => 'POST',
			'header'  => 'Content-type: application/x-www-form-urlencoded;charset=UTF-8',
			'content' => $postdata,
		),
	);

	$context = stream_context_create( $opts );

	$response = file_get_contents( $token_url, false, $context );
	//mikrogramma_debug( $response );
	$params = null;
	$params = json_decode( $response, true );

	$_SESSION['access_token']   = $params['access_token'];
	$_SESSION['refresh_token']  = $params['refresh_token'];
	$_SESSION['token_lifetime'] = $params['expires_in'];
	$_SESSION['token_expires']  = time() + $params['expires_in'];
}

function login_netatmo() {

	require_once 'Config.php';

	global $local_url;

	//session_start();
	$_SESSION = array();

	$_SESSION['state'] = md5( uniqid( rand(), true ) );
	$dialog_url        = 'https://api.netatmo.com/oauth2/authorize?client_id='
	. $client_id . '&redirect_uri=' . urlencode( $local_url )
	. '&scope=read_station'
	. '&state=' . $_SESSION['state'];

	//echo $dialog_url;
	header( 'Location: ' . $dialog_url );
	die();

	//$output = "<script>top.location.href='" . $dialog_url . "'</script>";

	//return $output;
}

function logout_netatmo() {
	session_unset();
	echo 'Sinut on kirjattu ulos. <a href="' . basename( $_SERVER['PHP_SELF'] ) . '">Kirjaudu uudelleen.</a>';
	die();
}

/**
 * Mikrogramma Debug function prints any variable or array
 */
//phpcs:disable
function mikrogramma_debug( $var) {
	$output = '';

	$el_start = '<pre style="font-size: 12px; color: #222222; background-color: #fafafa; padding: 5px; margin: 5px; border: 1px solid #cccccc; position: relative; z-index: 9999;">';
	$el_end   = '</pre>' . PHP_EOL;


	if ( isset( $var ) && ! empty( $var ) ) {
		$output .= $el_start;
		$output .= print_r( $var, true );
		$output .= $el_end;
	} elseif ( empty( $var ) ) {
		$output .= $el_start . 'Variable is empty.' . $el_end;
	} else {
		$output .= $el_start . 'Variable not defined.' . $el_end;
	}

	echo $output ;
}
//phpcs:enable

?>

	<script src="netatmo.js"></script>
</body>
</html>
