<?php

// Resume PHP session
if( ! isset( $_SESSION ) ) {
	session_start();
}

// Set the correct timezone in order to print correctly formatted time
date_default_timezone_set('Europe/Helsinki');

// Read client credentials from a config file
require 'config.php';

// Define time constants
define( 'MINUTE_IN_SECONDS', 60 );
define( 'HOUR_IN_SECONDS', 60 * MINUTE_IN_SECONDS );
define( 'DAY_IN_SECONDS', 24 * HOUR_IN_SECONDS );
define( 'WEEK_IN_SECONDS', 7 * DAY_IN_SECONDS );
define( 'MONTH_IN_SECONDS', 30 * DAY_IN_SECONDS );
define( 'YEAR_IN_SECONDS', 365 * DAY_IN_SECONDS );

// Define automatic update interval
DEFINE( 'NETATMO_UPDATE_INTERVAL', 2 * MINUTE_IN_SECONDS );

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

		//mikrogramma_debug( $station );

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
			<?php if( 'indoor' === $module_type ) :
				$co2_level = $module->dashboard_data->CO2;
				$co2_color = false;
				if ( $co2_level > 1 ) {
					$co2_color = 'green';
				}
				if ( $co2_level > 700 ) {
					$co2_color = 'light-green';
				}
				if ( $co2_level > 1000 ) {
					$co2_color = 'yellow';
				}
				if ( $co2_level > 1500 ) {
					$co2_color = 'orange';
				}
				if ( $co2_level > 2000 ) {
					$co2_color = 'red';
				}

			?>
			<div class="module__details--co2 co2-level-<?php echo $co2_color; ?>" title="<?php echo $co2_level; ?>"></div>
			<div class="module__details--humidity"><?php echo $module->dashboard_data->Humidity; ?> %</div>
			<?php endif; ?>
			<div class="module__details--temp"><?php
				$temperature = number_format( $module->dashboard_data->Temperature, 1 );
				$temperature_parts = explode( '.', $temperature );
				echo '<span class="module__details--temp__integer">' . $temperature_parts[0] . '</span><span class="module__details--temp__decimal">' . $temperature_parts[1] . '°</span>';
			?></div>
			<?php if( 'outdoor' === $module_type ) : ?>
			<div class="module__details--minmax">
				<svg xmlns="http://www.w3.org/2000/svg" width="65.6" height="95" viewBox="0 0 65.6 95"><path d="M64.5 42.8l-7.9-7.9-18.2 18.3V0H27.2v53.2L9 34.9l-7.9 7.9 31.7 31.7zM0 83.9h65.6V95H0z"/></svg>
				<?php echo number_format( $module->dashboard_data->min_temp, 1); ?>°
				<svg xmlns="http://www.w3.org/2000/svg" width="65.6" height="95" viewBox="0 0 65.6 95"><path d="M1.1 52.2L9 60.1l18.2-18.3V95h11.2V41.8l18.2 18.3 7.9-7.9-31.7-31.7zM0 0h65.6v11.1H0z"/></svg>
				<?php echo number_format( $module->dashboard_data->max_temp, 1); ?>°
			</div>
			<?php endif; ?>
			<span class="module__details--time" data-time-measured="<?php echo $module->dashboard_data->time_utc; ?>">
				<?php echo human_time_difference( $module->dashboard_data->time_utc ); ?>
			</span> <span>sitten</span>
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

	foreach( array_keys( $params ) as $key ) {
		$_SESSION[ $key ] = $params[ $key ];
	}

	$_SESSION['token_expires'] = time() + $params['expires_in'];
}

/**
 * Refresh the access token
 */
function refresh_token() {

	global $client_id;
	global $client_secret;

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
		foreach( array_keys( $params ) as $key ) {
			$_SESSION[ $key ] = $params[ $key ];
		}
		$_SESSION['token_expires'] = time() + $params['expires_in'];
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

function human_time_difference( $timestamp ) {

	$seconds = time() - $timestamp;

	$interval = floor( $seconds / YEAR_IN_SECONDS );

	if ( $interval > 1 ) {
		return $interval . " vuotta";
	}
	$interval = floor( $seconds / MONTH_IN_SECONDS );
	if ( $interval > 1 ) {
		return $interval . " kuukautta";
	}
	$interval = floor( $seconds / DAY_IN_SECONDS );
	if ( $interval > 1 ) {
		return $interval . " päivää";
	}
	$interval = floor( $seconds / HOUR_IN_SECONDS );
	if ( $interval > 1 ) {
		return $interval . " tuntia";
	}
	$interval = floor( $seconds / MINUTE_IN_SECONDS );
	if ( $interval > 1 ) {
		return $interval . " minuuttia";
	}
	if ( $interval >= 1 ) {
		return "Minuutti";
	}
	return floor( $seconds ) . " sekuntia";
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
