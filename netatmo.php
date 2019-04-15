<?php

if( ! isset( $_SESSION ) ) {
	session_start();
}

// Read client credentials from a config file
require 'config.php';

/**
 * Print temperatures for all modules
 */
function print_temperatures() {

	// Refresh expired token
	if( time() > $_SESSION['token_expires'] ) {
		$token_status = refresh_token();
		if ( false === $token_status ) {
			throw new Exception( 'Refreshing tokens failed.' );
		}
	}

	$api_url = 'https://api.netatmo.com/api/getstationsdata?access_token=' . $_SESSION['access_token'];

	$remote_data = file_get_contents( $api_url );

	if ( false === $remote_data ) {
		throw new Exception( 'Failed to get station data.' );
	}

	$stations = json_decode( $remote_data );

	if ( null !== $stations ) {

		$output = '';
		// Take only the first station's info
		$station = $stations->body->devices[0];

		$output .= '<div class="modules">';

		// Print the main module info
		$output .= get_module_info( $station );

		// Print the info for each submodule
		foreach ( $station->modules as $module ) {
			$output .= get_module_info( $module );
		}

		$output .= '</div>';

		$output .= '<p>Tiedot haettu ' . date( 'j.n.Y H:i:s' ) . '. ';
		$output .= 'Istunto vanhenee ' . date( 'j.n.Y H:i:s',  $_SESSION['token_expires'] ) . '.</p>';

		return $output;
	} else {
		return '<p>Istunto ei ole voimassa. <a href="' . basename( $_SERVER['PHP_SELF'] ) . '">Kirjaudu uudelleen.</a></p>';
	}
}

/**
 * Get single module info
 */
function get_module_info( $module ) {

	global $station_mac;

	$output = '';
	ob_start();
	?>
	<div class="module">
		<div class="module__name">
			<?php echo $module->module_name; ?>
		</div>
		<div class="module__temp">
			<?php echo number_format( $module->dashboard_data->Temperature, 1 ); ?>
		</div>
		<div class="module__time">
			<?php echo date( 'j.n.Y H:i:s', $module->dashboard_data->time_utc ); ?>
		</div>
		<?php

		$output .= ob_get_clean();

		$module_query = http_build_query(
			array(
				'access_token' => $_SESSION['access_token'],
				'device_id'    => $station_mac,
				'module_id'    => $module->_id,
				'scale'        => 'max',
				'real_time'    => 'true',
				'type'         => 'Temperature',
				'date_begin'   => ( time() - 24 * 60 * 60 ),
				'limit'        => 400,
			)
		);
		$module_api_url = 'https://api.netatmo.com/api/getmeasure?' . $module_query;

		$module_history = file_get_contents( $module_api_url );
		$module_history_json = json_decode( $module_history );

		//mikrogramma_debug( $module_history_json );

		$data_points = array();

		foreach ( $module_history_json->body as $data_point ) {

			foreach( $data_point->value as $index => $value ) {
				if( $index === 0 ) {
					$point_x = $data_point->beg_time * 1000;
					$point_y = $data_point->value[0][0];
				} else {
					$point_x = ( $data_point->beg_time + $data_point->step_time ) * 1000;
					$point_y = $data_point->value[$index][0];
				}

				$data_points[] = [ $point_x, $point_y ];
			}
		}

		if ( $module->type === 'NAMain' || $module->type === 'NAModule4' ) {
			$module_type = 'indoor';
		} elseif ( $module->type === 'NAModule1' ) {
			$module_type = 'outdoor';
		}

		$output .= '<div class="ct-chart ct-minor-seventh" id="module-' . strtolower( trim( preg_replace( '/[^A-Za-z0-9-]+/', '-', $module->_id ) ) ) . '" data-points="' . json_encode( $data_points ) . '" data-module-type="' . $module_type . '"></div>';

		$output .= '</div>';

		return $output;
}

/**
 * Get access token
 */
function get_access_token() {

	$code = $_GET['code'];

	global $client_id;
	global $client_secret;
	global $local_url;

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

	//require 'config.php';

	global $client_id;
	global $client_secret;

	mikrogramma_debug( $client_id );
	mikrogramma_debug( $client_secret );
	mikrogramma_debug( $_SESSION );

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

	if ( false !== $response ) {
		$params = json_decode( $response, true );

		$_SESSION['access_token']   = $params['access_token'];
		$_SESSION['refresh_token']  = $params['refresh_token'];
		$_SESSION['token_lifetime'] = $params['expires_in'];
		$_SESSION['token_expires']  = time() + $params['expires_in'];
		return;
	} else {
		return false;
	}
}

/**
 * Authenticate using Netatmo OAuth2 dialog
 * @link https://dev.netatmo.com/resources/technical/guides/authentication/authorizationcode
 */
function login_netatmo() {

	global $client_id;
	global $local_url;

	$_SESSION = array();

	// Generate unique session ID
	$_SESSION['state'] = md5( uniqid( rand(), true ) );

	// Build URL
	$dialog_url_params = http_build_query(
		array(
			'client_id'    => $client_id,
			'redirect_uri' => urlencode( $local_url ),
			'scope'        => 'read_station',
			'state'        => $_SESSION['state'],
		)
	);

	$dialog_url = 'https://api.netatmo.com/oauth2/authorize?' . $dialog_url_params;

	header( 'Location: ' . $dialog_url );
	die();
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
function mikrogramma_debug( $var, $return = false ) {
	$output = '';

	$el_start = '<pre style="font-size: 12px; color: #222222; background-color: #fafafa; padding: 5px; margin: 5px; border: 1px solid #cccccc; position: relative; z-index: 9999; overflow: auto; text-align: left;">';
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

	if ( $return ) {
		return $output;
	} else {
		echo $output;
	}
}
//phpcs:enable
