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
DEFINE( 'NETATMO_UPDATE_INTERVAL', 11 * MINUTE_IN_SECONDS );

/**
 * Drop-in replacement for PHP's "file_get_contents", as "allow_url_fopen"
 * is not allowed at Opalstack.
 */
function ug_file_get_contents( $url ) {

	if ( ! function_exists( 'curl_init' ) ) {
		die( 'CURL is not installed!' );
	}
	$ch = curl_init();

	if ( $ch === false ) {
		throw new Exception( 'failed to initialize' );
	}

	curl_setopt( $ch, CURLOPT_URL, $url );
	curl_setopt( $ch, CURLOPT_RETURNTRANSFER, true );

	$output = curl_exec( $ch );

	// Check the return value of curl_exec(), too.
	if ( $output === false ) {
		throw new Exception( curl_error( $ch ), curl_errno( $ch ) );
	}

	curl_close( $ch );
	return $output;
}

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

	$remote_data = ug_file_get_contents( $api_url );

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

		// Find the rain gauge module and its index amongst connected modules
		$rain_gauge_index = array_search( 'NAModule3', array_column( $station->modules, 'type' ) );

		$output .= 	'<div id="temperatures">';
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
		$output .= '</div>';

		//$output .= '<p class="data-time">Tiedot haettu ' . date( 'j.n.Y H:i:s' ) . '. ';
		//$output .= 'Istunto vanhenee ' . date( 'j.n.Y H:i:s', $_SESSION['token_expires'] ) . '.</p>';

		$output .= print_forecast();

		return $output;
	} else {
		return '<p>Istunto ei ole voimassa. <a href="' . basename( $_SERVER['PHP_SELF'] ) . '">Kirjaudu uudelleen.</a></p>';
	}
}

/**
 * Get single module info
 */
function get_module_info( $module, $rain_module = false ) {

	if ( $module->type === 'NAMain' || $module->type === 'NAModule4' ) {
		$module_type = 'indoor';
	} elseif ( $module->type === 'NAModule1' ) {
		$module_type = 'outdoor';
	} elseif ( $module->type === 'NAModule3' ) {
		$module_type = 'rain_gauge';
	}

	$output = '';
	ob_start();
	?>
	<div class="module padded module-<?php echo $module_type; ?>">
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

			<div class="module__details--temp
			<?php
				$temperature       = number_format( $module->dashboard_data->Temperature, 1 );

				// Modify classes when very cold to compensate the char amount (font size) with CSS
				if ( $temperature <= -10 ) {
					echo ' module__details--temp-verycold';
				}
				echo '">';

				$temperature_parts = explode( '.', $temperature );
				echo '<span class="module__details--temp__integer">' . $temperature_parts[0] . '</span><span class="module__details--temp__decimal">' . $temperature_parts[1] . '°</span>';
			?>
			</div>
			<?php if ( 'outdoor' === $module_type ) : ?>
			<div class="module__details--minmax">
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"  stroke-linecap="round" stroke-linejoin="round" class="icon-stroked feather feather-droplet"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>
				<?php echo $module->dashboard_data->Humidity; ?> %
				<svg xmlns="http://www.w3.org/2000/svg" width="65.6" height="95" viewBox="0 0 65.6 95" class="icon-filled"><path d="M64.5 42.8l-7.9-7.9-18.2 18.3V0H27.2v53.2L9 34.9l-7.9 7.9 31.7 31.7zM0 83.9h65.6V95H0z"/></svg>
				<?php echo number_format( $module->dashboard_data->min_temp, 1 ); ?>°
				<svg xmlns="http://www.w3.org/2000/svg" width="65.6" height="95" viewBox="0 0 65.6 95" class="icon-filled"><path d="M1.1 52.2L9 60.1l18.2-18.3V95h11.2V41.8l18.2 18.3 7.9-7.9-31.7-31.7zM0 0h65.6v11.1H0z"/></svg>
				<?php echo number_format( $module->dashboard_data->max_temp, 1 ); ?>°
				<?php if ( $rain_module->reachable === true ) : ?>
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="icon-stroked"><path d="M23 12a11.05 11.05 0 0 0-22 0zm-5 7a3 3 0 0 1-6 0v-7"></path></svg>
				<?php echo $rain_module->dashboard_data->sum_rain_24; ?> mm
				<?php endif; ?>
			</div>
			<?php endif; ?>
		</div>
	<?php

	$output .= ob_get_clean();

	$recent_history_query = http_build_query(
		array(
			'access_token' => $_SESSION['access_token'],
			'device_id'    => STATION_MAC,
			'module_id'    => $module->_id,
			'scale'        => 'max',
			'real_time'    => 'true',
			'type'         => 'Temperature,Humidity',
			'date_begin'   => strtotime( 'yesterday', time() ),//( time() - ( 2 * DAY_IN_SECONDS ) ),
			//'limit'        => 1000,
		)
	);

	$module_api_url      = 'https://api.netatmo.com/api/getmeasure?' . $recent_history_query;
	$module_history      = ug_file_get_contents( $module_api_url );
	$module_history_json = json_decode( $module_history );

	$recent_temperatures = array();
	$further_temperatures = array();
	$recent_humidity = array();
	$time_24hrs_ago = strtotime( 'today', time() );//time() - DAY_IN_SECONDS;
	$min_temp = $max_temp = $module_history_json->body[0]->value[0][0];
	$min_hmdy = $max_hmdy = $module_history_json->body[0]->value[0][1];

	foreach ( $module_history_json->body as $data_point ) {

		foreach ( $data_point->value as $index => $value ) {
			if ( $index === 0 ) {
				$time = $data_point->beg_time;
				$temp = $data_point->value[0][0];
				$hmdy = $data_point->value[0][1];
			} else {
				$time = $data_point->beg_time + $data_point->step_time;
				$temp = $data_point->value[ $index ][0];
				$hmdy = $data_point->value[ $index ][1];
			}

			if( $time < $time_24hrs_ago ) {
				$further_temperatures[] = [ ( $time + DAY_IN_SECONDS ) * 1000, $temp ];
			}
			else {
				$recent_temperatures[] = [ $time * 1000, $temp ];
				$recent_humidity[] = [ $time * 1000, $hmdy ];
			}

			if( $temp > $max_temp ) {
				$max_temp = $temp;
			}
			if( $temp < $min_temp ) {
				$min_temp = $temp;
			}

			if( $hmdy > $max_hmdy ) {
				$max_hmdy = $hmdy;
			}
			if( $hmdy < $min_hmdy ) {
				$min_hmdy = $hmdy;
			}
		}
	}

	/**
	 * Add current time as last data point, to compensate possible data or
	 * service outages.
	 */
	$recent_temperatures[] = [ time() * 1000, null ];

	/**
	 * Perform query for rain gauge measures.
	 */
	if ( $module_type === 'outdoor' ) {

		if ( $rain_module ) {
			$rain_query = http_build_query(
				array(
					'access_token' => $_SESSION['access_token'],
					'device_id'    => STATION_MAC,
					'module_id'    => $rain_module->_id,
					'scale'        => '30min',
					'real_time'    => 'true',
					'type'         => 'sum_rain',
					// 'date_begin'   => strtotime('today') - 10 * 60 * 60,
					'date_begin'   => strtotime( 'today', time() ), //( time() - 24 * HOUR_IN_SECONDS ),
					'limit'        => 100,
				)
			);

			$module_api_url      = 'https://api.netatmo.com/api/getmeasure?' . $rain_query;
			$module_history      = ug_file_get_contents( $module_api_url );
			$module_history_json = json_decode( $module_history );
			$rain_data_points = array();

			foreach ( $module_history_json->body as $data_point ) {

				foreach ( $data_point->value as $index => $value ) {
					if ( $index === 0 ) {
						$time = ( $data_point->beg_time ) * 1000;
						$temp = $data_point->value[0][0];
					} else {
						$time = ( $data_point->beg_time + $data_point->step_time * $index ) * 1000;
						$temp = $data_point->value[ $index ][0];
					}
					$rain_data_points[] = [ $time, $temp ];
				}
			}
		}
	}

	$output .= '<div class="flot-chart" id="module-' . strtolower( trim( preg_replace( '/[^A-Za-z0-9-]+/', '-', $module->_id ) ) ) . '" data-points="' . json_encode( $recent_temperatures ) . '" data-module-type="' . $module_type . '" data-min-temp="' . $min_temp . '" data-max-temp="' . $max_temp . '" data-min-hmdy="' . $min_hmdy . '" data-max-hmdy="' . $max_hmdy . '"';

	$output .= ' data-further-points="' . json_encode( $further_temperatures ) . '"';

	$output .= ' data-humidity="' . json_encode( $recent_humidity ) . '"';

	if ( $module_type === 'outdoor' ) {
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

	$token_url = 'https://api.netatmo.com/oauth2/token';

	$post_content = array(
		'grant_type'    => 'authorization_code',
		'client_id'     => CLIENT_ID,
		'client_secret' => CLIENT_SECRET,
		'code'          => $code,
		'redirect_uri'  => LOCAL_URL,
		'scope'         => 'read_station',
	);

	$ch = curl_init();

	curl_setopt( $ch, CURLOPT_URL, $token_url );
	curl_setopt( $ch, CURLOPT_RETURNTRANSFER, 1 );
	curl_setopt( $ch, CURLOPT_POSTFIELDS, $post_content );

	$response = curl_exec( $ch );

	curl_close( $ch );

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

	$token_url = 'https://api.netatmo.com/oauth2/token';

	$post_content = array(
		'grant_type'    => 'refresh_token',
		'client_id'     => CLIENT_ID,
		'client_secret' => CLIENT_SECRET,
		'refresh_token' => $_SESSION['refresh_token'],
	);

	$ch = curl_init();

	curl_setopt( $ch, CURLOPT_URL, $token_url );
	curl_setopt( $ch, CURLOPT_RETURNTRANSFER, 1 );
	curl_setopt( $ch, CURLOPT_POSTFIELDS, $post_content );

	$response = curl_exec( $ch );

	curl_close( $ch );

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

	// Generate unique session ID
	$_SESSION['state'] = md5( uniqid( rand(), true ) );

	// Build URL
	$dialog_url_params = http_build_query(
		array(
			'client_id'    => CLIENT_ID,
			'redirect_uri' => urlencode( LOCAL_URL ),
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
	$output = '';

	$fmi_weather_symbols = [
		3  => 7,
		22 => 32,
		23 => 33,
		31 => 37,
		32 => 38,
		33 => 39,
		63 => 77,
		81 => 47,
		82 => 48,
		83 => 49,
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

	// Get today's forecast, but only if there are hours left in this day
	$today_forecast = array();
	if( strtotime('tomorrow') < time() + HOUR_IN_SECONDS ) {
		$today_start_time = date( 'Y-m-d\TH:i:s', strtotime( 'tomorrow' ) - date( 'Z' ) );
		$today_end_time   = date( 'Y-m-d\TH:i:s', strtotime( 'tomorrow 23:00' ) - date( 'Z' ) );
		$today_timestep_hours = 2;
	} else {
		$today_start_time = date( 'Y-m-d\TH:i:s', time() - date( 'Z' ) );
		$today_end_time   = date( 'Y-m-d\TH:i:s', strtotime( 'tomorrow' ) - HOUR_IN_SECONDS - date( 'Z' ) );
		$today_timestep_hours = 1;
	}

	$today_forecast_url = 'https://opendata.fmi.fi/wfs?request=getFeature&starttime=' . $today_start_time . 'Z&endtime=' . $today_end_time . 'Z&latlon=' . LATITUDE . ',' . LONGITUDE . '&storedquery_id=fmi::forecast::harmonie::surface::point::timevaluepair&parameters=Temperature,WeatherSymbol3&timestep=' . $today_timestep_hours * 60;

	$today_forecast_raw = ug_file_get_contents( $today_forecast_url );
	$today_forecast_xml = simplexml_load_string( $today_forecast_raw );

	$temperatures = array();
	$symbols      = array();

	$today_members = $today_forecast_xml->children( 'wfs', true );

	$precipitation_start_time = null;

	foreach ( $today_members as $member ) {
		$result = $member->children( 'omso', true )->children( 'om', true )->result;
		$points = $result->children( 'wml2', true );

		// Get element attributes to map temperatures to weather symbols
		foreach ( $points[0]->attributes( 'gml', true ) as $value ) {
			$value = (string) $value[0];
			if ( 'mts-1-1-Temperature' === $value ) {
				$temperatures = object_to_array( $points->children( 'wml2', true ) );
				foreach ( $temperatures->point as $index => $point ) {
					$point_time = strtotime( $point->MeasurementTVP->time );

					if ( $index === 0 ) {
						$precipitation_start_time = $point->MeasurementTVP->time;
					}

					$today_forecast[ $index ]['time'] = $point_time;
					$today_forecast[ $index ]['temp'] = $point->MeasurementTVP->value;
				}
			} elseif ( 'mts-1-1-WeatherSymbol3' === $value ) {
				$symbols = object_to_array( $points->children( 'wml2', true ) );
				foreach ( $symbols->point as $index => $point ) {
					$today_forecast[ $index ]['symbol'] = $point->MeasurementTVP->value;
				}
			}
		}
	}

	$future_start_time = date( 'Y-m-d\TH:i:s', strtotime( $today_end_time ) );
	$future_end_time   = date( 'Y-m-d\TH:i:s', time() - date( 'Z' ) + 66 * HOUR_IN_SECONDS );
	$future_timestep_hours = 2;

	$future_forecast_url = 'https://opendata.fmi.fi/wfs?request=getFeature&starttime=' . $future_start_time . 'Z&endtime=' . $future_end_time . 'Z&latlon=62.7594,22.8683&storedquery_id=fmi::forecast::harmonie::surface::point::timevaluepair&parameters=Temperature,WeatherSymbol3&timestep=' . $future_timestep_hours * 60;

	$future_forecast_raw = ug_file_get_contents( $future_forecast_url );
	$future_forecast_xml = simplexml_load_string( $future_forecast_raw );
	$future_forecast = array();

	$future_members = $future_forecast_xml->children( 'wfs', true );

	foreach ( $future_members as $member ) {
		$result = $member->children( 'omso', true )->children( 'om', true )->result;
		$points = $result->children( 'wml2', true );

		// Get element attributes to map temperatures to weather symbols
		foreach ( $points[0]->attributes( 'gml', true ) as $value ) {
			$value = (string) $value[0];
			if ( 'mts-1-1-Temperature' === $value ) {
				$temperatures = object_to_array( $points->children( 'wml2', true ) );
				foreach ( $temperatures->point as $index => $point ) {
					$point_time = strtotime( $point->MeasurementTVP->time );

					$future_forecast[ $index ]['time'] = $point_time;
					$future_forecast[ $index ]['temp'] = $point->MeasurementTVP->value;
				}
			} elseif ( 'mts-1-1-WeatherSymbol3' === $value ) {
				$symbols = object_to_array( $points->children( 'wml2', true ) );
				foreach ( $symbols->point as $index => $point ) {
					$future_forecast[ $index ]['symbol'] = $point->MeasurementTVP->value;
				}
			}
		}
	}

	if( ! isset( $precipitation_start_time ) ) {
		$precipitation_start_time = $future_start_time;
	}

	$precipitation_forecast_url = 'https://opendata.fmi.fi/wfs?request=getFeature&starttime=' . $precipitation_start_time . '&endtime=' . $future_end_time . '&latlon=62.7594,22.8683&storedquery_id=fmi::forecast::harmonie::surface::point::timevaluepair&parameters=Precipitation1h&timestep=60';

	$precipitation_forecast_raw = ug_file_get_contents( $precipitation_forecast_url );
	$precipitation_forecast_xml = simplexml_load_string( $precipitation_forecast_raw );
	$precipitation_members = $precipitation_forecast_xml->children( 'wfs', true );
	$precipitation_forecast = array();
	$precipitations = array();

	foreach ( $precipitation_members as $member ) {
		$result = $member->children( 'omso', true )->children( 'om', true )->result;
		$points = $result->children( 'wml2', true );

		// Get element attributes to map temperatures to weather symbols
		foreach ( $points[0]->attributes( 'gml', true ) as $value ) {
			$value = (string) $value[0];
			if ( 'mts-1-1-Precipitation1h' === $value ) {
				$precipitations = object_to_array( $points->children( 'wml2', true ) );
				foreach ( $precipitations->point as $index => $point ) {
					$point_time = strtotime( $point->MeasurementTVP->time );
					$precipitation_forecast[ $point_time ] = $point->MeasurementTVP->value;
					//$precipitation_forecast[ $index ]['time'] = $point_time;
					//$precipitation_forecast[ $index ]['precipitation'] = $point->MeasurementTVP->value;
				}
			}
		}
	}

	$print_weekday = false;
	$every_other_weekday = false;
	$day_counter = 1;
	$forecast_data_points = 20;

	$output .= '<div id="forecast" class="padded">';

	$previous_data_point_hour = date( 'H', time() );

	foreach ( $today_forecast as $index => $data_point ) {

		// Print only defined amount of data points at maximum
		if ( $forecast_data_points <= 0 ) {
			continue;
		}

		// If weather forecast data point does not contain weather symbol, return early.
		if ( ! is_numeric( $data_point['symbol'] ) ) {
			continue;
		}

		// Skip late hours just until the late night
		if( (int) date( 'H', time() ) < 22 && (int) date( 'H', $data_point['time'] ) > 22 ) {
			continue;
		}

		if ( date( 'H', $data_point['time'] ) < $previous_data_point_hour ) {
			$every_other_weekday = !$every_other_weekday;
			$print_weekday = true;
		}

		$previous_data_point_hour = date( 'H', $data_point['time'] );

		$output .= '<div class="forecast__data-point near-future';

		if( $every_other_weekday ) {
			$output .= ' colored-bg';
		}

		$output .= '" data-time="' . $data_point['time'] . '">';

		if ( $print_weekday || 0 === $index ) {
			$output .= '<span class="forecast__data-point--weekday">' . $weekday_names[ date( 'D', $data_point['time'] ) ] . '</span>';
			if( 0 !== $index ) {
				$day_counter++;
			}
			$print_weekday = false;
		}

		$output .= '<span class="forecast__data-point--hour">' . date( 'H', $data_point['time'] ) . '</span>';

		$sunrise = date_sunrise( strtotime( 'tomorrow' ) , SUNFUNCS_RET_TIMESTAMP, 62.7594, 22.8683, 90.5 );
		$sunset  = date_sunset( time(), SUNFUNCS_RET_TIMESTAMP, 62.7594, 22.8683, 90.5 );

		$symbol_number = (int) $data_point['symbol'];
		if ( array_key_exists( $symbol_number, $fmi_weather_symbols ) ) {
			$symbol_number = $fmi_weather_symbols[ $symbol_number ];
		}

		if ( $data_point['time'] > $sunset && $data_point['time'] < $sunrise ) {
			$symbol_number = $symbol_number + 100;
		}

		$output .= '<svg class="weather-symbol symbol-' . $data_point['symbol'] . '">';
		$output .= '<use xlink:href="#' . $symbol_number . '" /></svg>';

		$output .= '<span class="forecast__data-point--temp">' . round( $data_point['temp'] ) . '</span><span class="forecast__data-point--celcius">°</span>';

		// Precipitation output
		$output .= '<table class="forecast__data-point--hmdy"><tbody><tr>';

		$precipitation_value = $precipitation_forecast[ $data_point['time'] ];

		if( false === is_numeric( $precipitation_value ) || $precipitation_value <= 0 ) {
			$precipitation_value = 0;
		}

		$output .= '<td class="forecast__data-point--hmdy-bar" data-precipitation-value="' . $precipitation_value . '">';

		if( $precipitation_value > 0 ) {
			$output .= '<div style="height:' . netatmo_calculate_precipitation_graph_height( $precipitation_value ) . 'px;"></div>';
		} else {
			$output .= '<div class="forecast__data-point--hmdy-bar__null"></div>';
		}

		$output .= '</td>';


		$output .= '</tr></tbody></table>';
		$output .= '<span class="forecast__data-point--hmdy-value" data-precipitation-subtotal="' . $precipitation_value . '">' . $precipitation_value . '</span>';

		$output .= '</div>' . PHP_EOL;

		$forecast_data_points--;
	}

	foreach ( $future_forecast as $index => $data_point ) {

		// Print only defined amount of data points at maximum
		if ( $forecast_data_points <= 0 ) {
			continue;
		}

		// If weather forecast data point does not contain weather symbol, return early.
		if ( ! is_numeric( $data_point['symbol'] ) ) {
			continue;
		}

		if( date( 'H', time() ) > 21 ) {
			$start_hour = 7;
			$end_hour = 21;
		} else {
			$start_hour = 7;
			$end_hour = 21;
		}

		if( (int) date( 'H', $data_point['time'] ) < $start_hour || (int) date( 'H', $data_point['time'] ) > $end_hour ) {
			continue;
		}

		if ( date( 'H', $data_point['time'] ) < $previous_data_point_hour ) {
			$every_other_weekday = !$every_other_weekday;
			$print_weekday = true;
		}

		$previous_data_point_hour = date( 'H', $data_point['time'] );

		$output .= '<div class="forecast__data-point far-future';

		if( $every_other_weekday ) {
			$output .= ' colored-bg';
		}

		$output .= '" data-time="' . $data_point['time'] . '">';

		if ( $print_weekday || 0 === $index ) {
			$output .= '<span class="forecast__data-point--weekday">' . $weekday_names[ date( 'D', $data_point['time'] ) ] . '</span>';
			if( 0 !== $index ) {
				$day_counter++;
			}
			$print_weekday = false;
		}

		$output .= '<span class="forecast__data-point--hour">' . date( 'H', $data_point['time'] ) . '</span>';

		$sunset  = date_sunset( $data_point['time'], SUNFUNCS_RET_TIMESTAMP, 62.7594, 22.8683, 90.5 );

		if( $data_point['time'] > $sunset ) {
			$sunrise = date_sunrise( strtotime( 'tomorrow' ) , SUNFUNCS_RET_TIMESTAMP, 62.7594, 22.8683, 90.5 );
		} else {
			$sunrise = date_sunrise( $data_point['time'] , SUNFUNCS_RET_TIMESTAMP, 62.7594, 22.8683, 90.5 );
		}

		$symbol_number = (int) $data_point['symbol'];
		if ( array_key_exists( $symbol_number, $fmi_weather_symbols ) ) {
			$symbol_number = $fmi_weather_symbols[ $symbol_number ];
		}

		if ( $data_point['time'] > $sunset || $data_point['time'] < $sunrise ) {
			$symbol_number = $symbol_number + 100;
		}

		$output .= '<svg class="weather-symbol symbol-' . $data_point['symbol'] . '">';
		$output .= '<use xlink:href="#' . $symbol_number . '" /></svg>';

		$output .= '<span class="forecast__data-point--temp">' . round( $data_point['temp'] ) . '</span><span class="forecast__data-point--celcius">°</span>';

		// Precipitation output
		$output .= '<table class="forecast__data-point--hmdy"><tbody><tr>';

		$precipitation_subtotal = 0;

		for( $i = 0; $i < $future_timestep_hours; $i++ ) {
			$precipitation_value = $precipitation_forecast[ $data_point['time'] + $i * HOUR_IN_SECONDS ];

			if( is_numeric( $precipitation_value ) ) {
				$precipitation_subtotal = $precipitation_subtotal + $precipitation_value;
			} else {
				$precipitation_value = 0;
			}

			$output .= '<td class="forecast__data-point--hmdy-bar" data-precipitation-value="' . $precipitation_value . '">';

			if ( $precipitation_value > 0 ) {
				$output .= '<div style="height:' . netatmo_calculate_precipitation_graph_height( $precipitation_value ) . 'px;"></div>';
			} else {
				$output .= '<div class="forecast__data-point--hmdy-bar__null"></div>';
			}

			$output .= '</td>';
		}

		$output .= '</tr></tbody></table>';
		$output .= '<span class="forecast__data-point--hmdy-value" data-precipitation-subtotal="' . $precipitation_subtotal . '">' . $precipitation_subtotal . '</span>';

		$output .= '</div>' . PHP_EOL;

		$forecast_data_points--;
	}


	$output .= '</div>';
	return $output;
}

function netatmo_calculate_precipitation_graph_height( $value ) {
	$graph_max_height = 20; // max height in pixels, refer to CSS defs
	$full_graph_scale = 10; // full scale in precipitation millimeters
	return ceil( $value / $full_graph_scale * $graph_max_height );
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
