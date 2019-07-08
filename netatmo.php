<?php

// Resume PHP session
if ( ! isset( $_SESSION ) ) {
	session_start();
}

// Set the correct timezone in order to print correctly formatted time
date_default_timezone_set( 'Europe/Helsinki' );

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
DEFINE( 'NETATMO_UPDATE_INTERVAL', 11 * MINUTE_IN_SECONDS - 45 );

/**
 * Print temperatures for all modules
 */
function print_temperatures() {

	// Refresh expired token
	if ( time() > $_SESSION['token_expires'] ) {
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

		// mikrogramma_debug( $station );
		// Find the outdoor module and its index amongst connected modules
		$outdoor_module_index = array_search( 'NAModule1', array_column( $station->modules, 'type' ) );

		// Find the rain gauge module and its index amongst connected modules
		$rain_gauge_index = array_search( 'NAModule3', array_column( $station->modules, 'type' ) );

		$output .= '<div class="modules">';

		// Print the outdoor module info together with rain measures
		$output .= get_module_info( $station->modules[ $outdoor_module_index ], $station->modules[ $rain_gauge_index ] );

		// Print the main module info
		$output .= get_module_info( $station );

		// Print the info for each submodule
		foreach ( $station->modules as $module_index => $module ) {
			// Skip other than indoor modules
			if ( $module->type !== 'NAModule4' ) {
				continue;
			}
			$output .= get_module_info( $module );
		}

		$output .= '</div>';

		//$output .= '<p class="data-time">Tiedot haettu ' . date( 'j.n.Y H:i:s' ) . '. ';
		//$output .= 'Istunto vanhenee ' . date( 'j.n.Y H:i:s', $_SESSION['token_expires'] ) . '.</p>';

		return $output;
	} else {
		return '<p>Istunto ei ole voimassa. <a href="' . basename( $_SERVER['PHP_SELF'] ) . '">Kirjaudu uudelleen.</a></p>';
	}
}

/**
 * Get single module info
 */
function get_module_info( $module, $rain_module = false ) {

	global $station_mac;

	if ( $module->type === 'NAMain' || $module->type === 'NAModule4' ) {
		$module_type = 'indoor';
	} elseif ( $module->type === 'NAModule1' ) {
		$module_type = 'outdoor';
	} elseif ( $module->type === 'NAModule3' ) {
		$module_type = 'rain_gauge';
	}

	//mikrogramma_debug( $module );

	$output = '';
	ob_start();
	?>
	<div class="module module-<?php echo $module_type; ?>">
		<div class="module__details">
			<div class="module__details--name">
				<?php echo $module->module_name; ?>
			</div>
			<?php
			if ( 'indoor' === $module_type ) :
				if ( isset( $module->dashboard_data->CO2 ) ) :
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
			<?php endif; ?>
			<div class="module__details--humidity"><?php echo $module->dashboard_data->Humidity; ?> %</div>
			<?php endif; ?>

			<div class="module__details--timediff">
				<span class="module__details--time" data-time-measured="<?php echo $module->dashboard_data->time_utc; ?>">
				<?php echo human_time_difference( $module->dashboard_data->time_utc ); ?>
				</span> <span>sitten</span>
			</div>

			<div class="module__details--temp">
			<?php
				$temperature       = number_format( $module->dashboard_data->Temperature, 1 );
				$temperature_parts = explode( '.', $temperature );
				echo '<span class="module__details--temp__integer">' . $temperature_parts[0] . '</span><span class="module__details--temp__decimal">' . $temperature_parts[1] . '°</span>';
			?>
			</div>
			<?php if ( 'outdoor' === $module_type ) : ?>
			<div class="module__details--minmax">
				<svg xmlns="http://www.w3.org/2000/svg" width="65.6" height="95" viewBox="0 0 65.6 95" class="icon-filled"><path d="M64.5 42.8l-7.9-7.9-18.2 18.3V0H27.2v53.2L9 34.9l-7.9 7.9 31.7 31.7zM0 83.9h65.6V95H0z"/></svg>
				<?php echo number_format( $module->dashboard_data->min_temp, 1 ); ?>°
				<!-- <small>&mdash;</small>
				<?php echo date( 'H:i', $module->dashboard_data->date_min_temp ); ?> -->
				<svg xmlns="http://www.w3.org/2000/svg" width="65.6" height="95" viewBox="0 0 65.6 95" class="icon-filled"><path d="M1.1 52.2L9 60.1l18.2-18.3V95h11.2V41.8l18.2 18.3 7.9-7.9-31.7-31.7zM0 0h65.6v11.1H0z"/></svg>
				<?php echo number_format( $module->dashboard_data->max_temp, 1 ); ?>°
				<!-- <small>&mdash;</small>
				<?php echo date( 'H:i', $module->dashboard_data->date_max_temp ); ?> -->
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="icon-stroked"><path d="M23 12a11.05 11.05 0 0 0-22 0zm-5 7a3 3 0 0 1-6 0v-7"></path></svg>
				<?php echo $rain_module->dashboard_data->sum_rain_24; ?>mm
			</div>
			<?php endif; ?>
		</div>
	<?php

	$output .= ob_get_clean();

	$recent_history_query = http_build_query(
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

	$module_api_url      = 'https://api.netatmo.com/api/getmeasure?' . $recent_history_query;
	$module_history      = file_get_contents( $module_api_url );
	$module_history_json = json_decode( $module_history );

	$recent_data_points = array();

	foreach ( $module_history_json->body as $data_point ) {

		foreach ( $data_point->value as $index => $value ) {
			if ( $index === 0 ) {
				$point_x = $data_point->beg_time * 1000;
				$point_y = $data_point->value[0][0];
			} else {
				$point_x = ( $data_point->beg_time + $data_point->step_time ) * 1000;
				$point_y = $data_point->value[ $index ][0];
			}
			$recent_data_points[] = [ $point_x, $point_y ];
		}
	}
	/**
	 * Add current time as last data point, to compensate possible data or
	 * service outages.
	 */
	$recent_data_points[] = [ time() * 1000, null ];

	/**
	 * Perform a query for yesterday's outdoor temperatures.
	 */
	if ( $module_type === 'outdoor' ) {
		$further_history_query = http_build_query(
			array(
				'access_token' => $_SESSION['access_token'],
				'device_id'    => $station_mac,
				'module_id'    => $module->_id,
				'scale'        => 'max',
				'real_time'    => 'true',
				'type'         => 'Temperature',
				'date_begin'   => ( time() - 48 * 60 * 60 ),
				'date_end'     => ( time() - 24 * 60 * 60 ),
				'limit'        => 400,
			)
		);

		$module_api_url      = 'https://api.netatmo.com/api/getmeasure?' . $further_history_query;
		$module_history      = file_get_contents( $module_api_url );
		$module_history_json = json_decode( $module_history );

		$further_data_points = array();

		foreach ( $module_history_json->body as $data_point ) {

			foreach ( $data_point->value as $index => $value ) {
				if ( $index === 0 ) {
					$point_x = ( $data_point->beg_time + 24 * 60 * 60 ) * 1000;
					$point_y = $data_point->value[0][0];
				} else {
					// Normalize x-axis points by adding 24 hours to timestamps
					$point_x = ( $data_point->beg_time + $data_point->step_time + 24 * 60 * 60 ) * 1000;
					$point_y = $data_point->value[ $index ][0];
				}
				$further_data_points[] = [ $point_x, $point_y ];
			}
		}

		/**
		 * Perform query for rain gauge measures.
			*/
		if ( $rain_module ) {
			$rain_query = http_build_query(
				array(
					'access_token' => $_SESSION['access_token'],
					'device_id'    => $station_mac,
					'module_id'    => $rain_module->_id,
					'scale'        => '30min',
					'real_time'    => 'true',
					'type'         => 'sum_rain',
					// 'date_begin'   => strtotime('today') - 10 * 60 * 60,
					'date_begin'   => ( time() - 24 * 60 * 60 ),
					'limit'        => 100,
				)
			);

			$module_api_url      = 'https://api.netatmo.com/api/getmeasure?' . $rain_query;
			$module_history      = file_get_contents( $module_api_url );
			$module_history_json = json_decode( $module_history );
			$rain_data_points = array();

			foreach ( $module_history_json->body as $data_point ) {

				foreach ( $data_point->value as $index => $value ) {
					if ( $index === 0 ) {
						$point_x = ( $data_point->beg_time ) * 1000;
						$point_y = $data_point->value[0][0];
					} else {
						$point_x = ( $data_point->beg_time + $data_point->step_time * $index ) * 1000;
						$point_y = $data_point->value[ $index ][0];
					}
					$rain_data_points[] = [ $point_x, $point_y ];
				}
			}
		}
	}

	$output .= '<div class="flot-chart" id="module-' . strtolower( trim( preg_replace( '/[^A-Za-z0-9-]+/', '-', $module->_id ) ) ) . '" data-points="' . json_encode( $recent_data_points ) . '" data-module-type="' . $module_type . '"';

	if ( $module_type === 'outdoor' ) {
		$output .= ' data-further-points="' . json_encode( $further_data_points ) . '"';

		if ( ! empty( $rain_data_points ) ) {
			$output .= ' data-rain-points="' . json_encode( $rain_data_points ) . '"';
		}
	}

	$output .= '></div></div>';

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
	$params   = null;
	$params   = json_decode( $response, true );

	foreach ( array_keys( $params ) as $key ) {
		$_SESSION[ $key ] = $params[ $key ];
	}

	$_SESSION['code']          = $code;
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
		foreach ( array_keys( $params ) as $key ) {
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
 *
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
	session_destroy();
	mikrogramma_debug( $_SESSION );
	echo 'Sinut on kirjattu ulos. <a href="' . basename( $_SERVER['PHP_SELF'] ) . '">Kirjaudu uudelleen.</a>';
	die();
}

function human_time_difference( $timestamp ) {

	$seconds = time() - $timestamp;

	$interval = floor( $seconds / YEAR_IN_SECONDS );

	if ( $interval > 1 ) {
		return $interval . ' vuotta';
	}
	$interval = floor( $seconds / MONTH_IN_SECONDS );
	if ( $interval > 1 ) {
		return $interval . ' kuukautta';
	}
	$interval = floor( $seconds / DAY_IN_SECONDS );
	if ( $interval > 1 ) {
		return $interval . ' päivää';
	}
	$interval = floor( $seconds / HOUR_IN_SECONDS );
	if ( $interval > 1 ) {
		return $interval . ' tuntia';
	}
	$interval = floor( $seconds / MINUTE_IN_SECONDS );
	if ( $interval > 1 ) {
		return $interval . ' minuuttia';
	}
	if ( $interval >= 1 ) {
		return 'Minuutti';
	}
	return floor( $seconds ) . ' sekuntia';
}

/**
 * Get weather forecast info from Ilmatieteenlaitos.
 */
function print_forecast() {
	$start_time = date( 'Y-m-d\TH:i:s', time() - date( 'Z' ) ) . '.000Z';
	$end_time   = date( 'Y-m-d\TH:i:s', time() - date( 'Z' ) + 66 * 60 * 60 ) . '.000Z';

	$day_counter = 0;

	$url = 'https://opendata.fmi.fi/wfs?request=getFeature&starttime=' . $start_time . '&endtime=' . $end_time . '&latlon=62.7594,22.8683&storedquery_id=fmi::forecast::harmonie::surface::point::timevaluepair&parameters=Temperature,WeatherSymbol3&timestep=60';

	$xml = simplexml_load_file( $url );

	$forecast     = array();
	$temperatures = array();
	$symbols      = array();

	$fmi_weather_symbols = [
		1  => 1,
		2  => 2,
		3  => 7,
		31 => 37,
		32 => 38,
		33 => 39,
		63 => 77,
	];

	$weekday_names = [
		'Mon' => 'Ma',
		'Tue' => 'Ti',
		'Wed' => 'Ke',
		'Thu' => 'To',
		'Fri' => 'Pe',
		'Sat' => 'La',
		'Sun' => 'Su',
	];

	$members = $xml->children( 'wfs', true );

	foreach ( $members as $member ) {
		$result = $member->children( 'omso', true )->children( 'om', true )->result;
		$points = $result->children( 'wml2', true );// ->children( 'wml2', true );

		// Get element attributes to map temperatures to weather symbols
		foreach ( $points[0]->attributes( 'gml', true ) as $value ) {
			$value = (string) $value[0];
			if ( 'mts-1-1-Temperature' === $value ) {
				$temperatures = object_to_array( $points->children( 'wml2', true ) );
				foreach ( $temperatures->point as $index => $point ) {
					$point_time                 = strtotime( $point->MeasurementTVP->time );
					$forecast[ $index ]['time'] = $point_time;
					$forecast[ $index ]['temp'] = $point->MeasurementTVP->value;
				}
			} elseif ( 'mts-1-1-WeatherSymbol3' === $value ) {
				$symbols = object_to_array( $points->children( 'wml2', true ) );
				foreach ( $symbols->point as $index => $point ) {
					$forecast[ $index ]['symbol'] = $point->MeasurementTVP->value;
				}
			}
		}
	}

	$every_other_weekday = false;
	$forecast_data_points = 20;
	$todays_forecast_printed = false;

	$next_days_forecast_points = array( '09', '12', '15', '18', '21' );

	foreach ( $forecast as $data_point ) {

		// Print only defined amount of data points at maximum
		if ( $forecast_data_points <= 0 ) {
			continue;
		}

		// If weather forecast data point does not contain weather symbol, return early.
		if ( ! is_numeric( $data_point['symbol'] ) ) {
			continue;
		}

		if ( '00' === date( 'H', $data_point['time'] ) ) {
			$every_other_weekday = !$every_other_weekday;
			$todays_forecast_printed = true;
		}

		if ( $todays_forecast_printed && false === in_array( date( 'H', $data_point['time'] ), $next_days_forecast_points ) ) {
			continue;
		}

		echo '<div class="forecast__data-point';
		if( $every_other_weekday ) {
			echo ' colored-bg';
		}

		echo '" data-time="' . $data_point['time'] . '">';
		if ( $next_days_forecast_points[0] === date( 'H', $data_point['time'] ) ) {
			echo '<span class="forecast__data-point--weekday">' . $weekday_names[ date( 'D', $data_point['time'] ) ] . '</span><br/>';
			$day_counter++;
		}

		echo '<span class="forecast__data-point--hour">' . date( 'H', $data_point['time'] ) . '</span><br/>';

		$sunrise = date_sunrise( time() + $day_counter * DAY_IN_SECONDS , SUNFUNCS_RET_TIMESTAMP, 62.7594, 22.8683, 90 );
		$sunset  = date_sunset( + $day_counter * DAY_IN_SECONDS, SUNFUNCS_RET_TIMESTAMP, 62.7594, 22.8683, 90 );

		echo '<img class="weather-symbol symbol-' . $data_point['symbol'] . '" src="https://cdn.fmi.fi/symbol-images/smartsymbol/v3/p/';

		if ( $data_point['time'] > $sunset && $data_point['time'] < $sunrise ) {
			echo $fmi_weather_symbols[ (int) $data_point['symbol'] ] + 100 . '.svg">';
		} else {
			echo $fmi_weather_symbols[ (int) $data_point['symbol'] ] . '.svg">';
		}

		echo '<br/>';
		echo '<span class="forecast__data-point--temp">' . round( $data_point['temp'] ) . '</span><span class="forecast__data-point--celcius">°</span>';
		echo '</div>';

		$forecast_data_points--;
	}
}

function object_to_array( $object ) {
	$object_as_json = json_encode( $object );
	$array          = json_decode( $object_as_json );
	return $array;
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
