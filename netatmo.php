<?php

// Read client credentials from a config file
require 'config.php';

DEFINE( 'NETATMO_COOKIE_NAME', 'netatmo' );
DEFINE( 'NETATMO_UPDATE_INTERVAL', 3 * 60 );

// Define time constants
define( 'MINUTE_IN_SECONDS', 60 );
define( 'HOUR_IN_SECONDS', 60 * MINUTE_IN_SECONDS );
define( 'DAY_IN_SECONDS', 24 * HOUR_IN_SECONDS );
define( 'WEEK_IN_SECONDS', 7 * DAY_IN_SECONDS );
define( 'MONTH_IN_SECONDS', 30 * DAY_IN_SECONDS );
define( 'YEAR_IN_SECONDS', 365 * DAY_IN_SECONDS );

/**
 * Print temperatures for all modules
 */
function print_temperatures() {

	$session = crud_cookie( 'read' );

	// Refresh expired token
	if( time() > $session['token_expires'] ) {
		$token_status = refresh_token();
		if ( false === $token_status ) {
			throw new Exception( 'Refreshing tokens failed.' );
		}
	}

	$api_url = 'https://api.netatmo.com/api/getstationsdata?access_token=' . $session['access_token'];

	$remote_data = file_get_contents( $api_url );

	if ( false === $remote_data ) {
		throw new Exception( 'Failed to get station data.' );
	}

	$stations = json_decode( $remote_data );

	if ( null !== $stations ) {

		$output = '';
		// Take only the first station's info
		$station = $stations->body->devices[0];

		// Find the outdoor module and its index amongst connected modules
		$outdoor_module_index = array_search( 'NAModule1', array_column( $station->modules, 'type' ) );

		$output .= '<div class="modules">';

		$output .= get_module_info( $station->modules[ $outdoor_module_index ] );

		// Print the main module info
		$output .= get_module_info( $station );

		// Print the info for each submodule
		foreach ( $station->modules as $module_index => $module ) {
			if ( $outdoor_module_index === $module_index ) {
				continue;
			}
			$output .= get_module_info( $module );
		}

		$output .= '</div>';

		$output .= '<p class="data-time">Tiedot haettu ' . date( 'j.n.Y H:i:s' ) . '. ';
		$output .= 'Istunto vanhenee ' . date( 'j.n.Y H:i:s',  $session['token_expires'] ) . '.</p>';

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

	$session = crud_cookie( 'read' );

	if ( $module->type === 'NAMain' || $module->type === 'NAModule4' ) {
		$module_type = 'indoor';
	} elseif ( $module->type === 'NAModule1' ) {
		$module_type = 'outdoor';
	}

	$output = '';
	ob_start();
	?>
	<div class="module module-<?php echo $module_type; ?>">
		<div class="module__details">
			<div class="module__details--name">
				<?php echo $module->module_name; ?>
			</div>
			<div class="module__details--temp"><?php
				$temperature = number_format( $module->dashboard_data->Temperature, 1 );
				$temperature_parts = explode( '.', $temperature );
				echo '<span class="module__details--temp__integer">' . $temperature_parts[0] . '</span><span class="module__details--temp__decimal">' . $temperature_parts[1] . '°</span>';
			?></div>
			<div class="module__details--time">
				<?php echo date( 'j.n.Y H:i:s', $module->dashboard_data->time_utc ); ?>
			</div>
		</div>
		<?php

		$output .= ob_get_clean();

		$module_query = http_build_query(
			array(
				'access_token' => $session['access_token'],
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

		$output .= '<div class="flot-chart" id="module-' . strtolower( trim( preg_replace( '/[^A-Za-z0-9-]+/', '-', $module->_id ) ) ) . '" data-points="' . json_encode( $data_points ) . '" data-module-type="' . $module_type . '"></div>';

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
	$params['token_expires']  = time() + $params['expires_in'];
	crud_cookie( 'update', $params );
}

/**
 * Refresh the access token
 */
function refresh_token() {

	//require 'config.php';

	global $client_id;
	global $client_secret;

	$token_url = 'https://api.netatmo.com/oauth2/token';

	$session = crud_cookie( 'read' );

	$postdata = http_build_query(
		array(
			'grant_type'    => 'refresh_token',
			'client_id'     => $client_id,
			'client_secret' => $client_secret,
			'refresh_token' => $session['refresh_token'],
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
		$params['token_expires']  = time() + $params['expires_in'];
		crud_cookie( 'update', $params );
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

	$session = array();

	// Generate unique session ID
	$session['state'] = md5( uniqid( rand(), true ) );

	crud_cookie( 'create', $session );

	// Build URL
	$dialog_url_params = http_build_query(
		array(
			'client_id'    => $client_id,
			'redirect_uri' => urlencode( $local_url ),
			'scope'        => 'read_station',
			'state'        => $session['state'],
		)
	);

	$dialog_url = 'https://api.netatmo.com/oauth2/authorize?' . $dialog_url_params;

	header( 'Location: ' . $dialog_url );
	die();
}

function logout_netatmo() {
	crud_cookie( 'delete' );

	echo 'Sinut on kirjattu ulos. <a href="' . basename( $_SERVER['PHP_SELF'] ) . '">Kirjaudu uudelleen.</a>';
	die();
}

/**
 * Create, read, update, delete cookie
 */
function crud_cookie( $action, $data = array() ) {

	switch( $action ) {
		case 'create':
			setcookie( NETATMO_COOKIE_NAME, json_encode( $data ), time() + 2 * MONTH_IN_SECONDS );
			header("Refresh:0");
			break;
		case 'read':
			if ( isset( $_COOKIE[NETATMO_COOKIE_NAME] ) ) {
				$cookie_data = json_decode( $_COOKIE[NETATMO_COOKIE_NAME], true );
				return $cookie_data;
			} else {
				return false;
			}
			break;
		case 'update':
			$cookie_data = json_decode( $_COOKIE[NETATMO_COOKIE_NAME], true );
			if ( is_array(( $cookie_data ) ) ) {
				//mikrogramma_debug( 'JEE is_array', true, true );
				$data = array_merge( $cookie_data, $data );
			}
			setcookie( NETATMO_COOKIE_NAME, json_encode( $data ), time() + 2 * MONTH_IN_SECONDS );
			header("Refresh:0");
			//mikrogramma_debug( $data, true, true );
			break;
		case 'delete':
			unset( $_COOKIE[NETATMO_COOKIE_NAME] );
			setcookie( NETATMO_COOKIE_NAME, '', time() - HOUR_IN_SECONDS );
			break;
	}

}

/**
 * Mikrogramma Debug function prints any variable or array
 */
//phpcs:disable
function mikrogramma_debug( $var, $return = false, $write_to_log = false ) {
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

	if ( $write_to_log ) {
		error_log( print_r( $var, true ) );
	}

	if ( $return ) {
		return $output;
	} else {
		echo $output;
	}
}
//phpcs:enable
