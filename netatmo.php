<?php

require 'vendor/autoload.php';

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
 * Print temperatures for all modules
 */
function print_temperatures() {

	if ( $_SESSION['expires_in'] < time() ) {
		refresh_token();
	}

	$api_url = 'https://api.netatmo.com/api/getstationsdata?access_token=' . $_SESSION['access_token'];

	$remote_data = file_get_contents( $api_url );

	if ( false === $remote_data ) {
		throw new Exception( 'Failed to get station data.' );
	}

	$stations = json_decode( $remote_data );

	if ( isset( $stations ) && null !== $stations ) {

		$output = '';
		// Take only the first station's info
		$station = $stations->body->devices[0];

		// Find the outdoor module and its index amongst connected modules
		$outdoor_module_index = array_search( 'NAModule1', array_column( $station->modules, 'type' ) );

		// Find the rain gauge module and its index amongst connected modules
		$rain_gauge_index = array_search( 'NAModule3', array_column( $station->modules, 'type' ) );

		$output .= '<div id="temperatures">';
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

		// $output .= '<p class="data-time">Tiedot haettu ' . date( 'j.n.Y H:i:s' ) . '. ';
		// $output .= 'Istunto vanhenee ' . date( 'j.n.Y H:i:s', $_SESSION['expires_in'] ) . '.</p>';

		$output .= print_yr_forecast();

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
				$temperature = number_format( $module->dashboard_data->Temperature, 1 );

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
				<span class="minmax__measurement"><?php echo $module->dashboard_data->Humidity; ?> %</span>
				<svg xmlns="http://www.w3.org/2000/svg" width="65.6" height="95" viewBox="0 0 65.6 95" class="icon-filled"><path d="M64.5 42.8l-7.9-7.9-18.2 18.3V0H27.2v53.2L9 34.9l-7.9 7.9 31.7 31.7zM0 83.9h65.6V95H0z"/></svg>
				<span class="minmax__measurement"><?php echo number_format( $module->dashboard_data->min_temp, 1 ); ?>°</span>
				<svg xmlns="http://www.w3.org/2000/svg" width="65.6" height="95" viewBox="0 0 65.6 95" class="icon-filled"><path d="M1.1 52.2L9 60.1l18.2-18.3V95h11.2V41.8l18.2 18.3 7.9-7.9-31.7-31.7zM0 0h65.6v11.1H0z"/></svg>
				<span class="minmax__measurement"><?php echo number_format( $module->dashboard_data->max_temp, 1 ); ?>°
				<?php if ( $rain_module->reachable === true ) : ?>
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="icon-stroked"><path d="M23 12a11.05 11.05 0 0 0-22 0zm-5 7a3 3 0 0 1-6 0v-7"></path></svg>
				<span class="minmax__measurement"><?php echo $rain_module->dashboard_data->sum_rain_24; ?> mm</span>
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
			'date_begin'   => strtotime( 'yesterday', time() ), // ( time() - ( 2 * DAY_IN_SECONDS ) ),
			// 'limit'        => 1000,
		)
	);

	$module_api_url      = 'https://api.netatmo.com/api/getmeasure?' . $recent_history_query;
	$module_history      = file_get_contents( $module_api_url );
	$module_history_json = json_decode( $module_history );

	$recent_temperatures  = array();
	$further_temperatures = array();
	$recent_humidity      = array();
	$time_24hrs_ago       = strtotime( 'today', time() );// time() - DAY_IN_SECONDS;
	$min_temp             = $max_temp = $module_history_json->body[0]->value[0][0];
	$min_hmdy             = $max_hmdy = $module_history_json->body[0]->value[0][1];

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

			if ( $time < $time_24hrs_ago ) {
				$further_temperatures[] = array( ( $time + DAY_IN_SECONDS ) * 1000, $temp );
			} else {
				$recent_temperatures[] = array( $time * 1000, $temp );
				$recent_humidity[]     = array( $time * 1000, $hmdy );
			}

			if ( $temp > $max_temp ) {
				$max_temp = $temp;
			}
			if ( $temp < $min_temp ) {
				$min_temp = $temp;
			}

			if ( $hmdy > $max_hmdy ) {
				$max_hmdy = $hmdy;
			}
			if ( $hmdy < $min_hmdy ) {
				$min_hmdy = $hmdy;
			}
		}
	}

	/**
	 * Add current time as last data point, to compensate possible data or
	 * service outages.
	 */
	$recent_temperatures[] = array( time() * 1000, null );

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
					'date_begin'   => strtotime( 'today', time() ), // ( time() - 24 * HOUR_IN_SECONDS ),
					'limit'        => 100,
				)
			);

			$module_api_url      = 'https://api.netatmo.com/api/getmeasure?' . $rain_query;
			$module_history      = file_get_contents( $module_api_url );
			$module_history_json = json_decode( $module_history );
			$rain_data_points    = array();

			foreach ( $module_history_json->body as $data_point ) {

				foreach ( $data_point->value as $index => $value ) {
					if ( $index === 0 ) {
						$time = ( $data_point->beg_time ) * 1000;
						$temp = $data_point->value[0][0];
					} else {
						$time = ( $data_point->beg_time + $data_point->step_time * $index ) * 1000;
						$temp = $data_point->value[ $index ][0];
					}
					$rain_data_points[] = array( $time, $temp );
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

	$provider = new \Rugaard\OAuth2\Client\Netatmo\Provider\Netatmo(
		array(
			'clientId'     => CLIENT_ID,
			'clientSecret' => CLIENT_SECRET,
			'redirectUri'  => LOCAL_URL,
		)
	);

	// Try to get an access token using the authorization code grant.
	$accessToken = $provider->getAccessToken(
		'authorization_code',
		array(
			'code' => $_GET['code'],
		)
	);

	// We have an access token, which we may use in authenticated
	// requests against the service provider's API.
	// Save tokens to session data.
	$_SESSION['access_token']  = $accessToken->getToken();
	$_SESSION['refresh_token'] = $accessToken->getRefreshToken();
	$_SESSION['expires_in']    = $accessToken->getExpires();
	$_SESSION['expired']       = $accessToken->hasExpired();
}

/**
 * Refresh the access token
 */
function refresh_token() {

	$provider = new \Rugaard\OAuth2\Client\Netatmo\Provider\Netatmo(
		array(
			'clientId'     => CLIENT_ID,
			'clientSecret' => CLIENT_SECRET,
			'redirectUri'  => LOCAL_URL,
		)
	);

	$newAccessToken = $provider->getAccessToken(
		'refresh_token',
		array(
			'refresh_token' => $_SESSION['refresh_token'],
		)
	);

	// Save tokens to session data.
	$_SESSION['access_token']  = $newAccessToken->getToken();
	$_SESSION['refresh_token'] = $newAccessToken->getRefreshToken();
	$_SESSION['expires_in']    = $newAccessToken->getExpires();
	$_SESSION['expired']       = $newAccessToken->hasExpired();
}

/**
 * Authenticate using Netatmo OAuth2 dialog.
 * We're using "Netatmo Provider for OAuth 2.0 Client" by Morten Rugaard.
 *
 * @link https://github.com/rugaard/oauth2-netatmo
 * @link https://oauth2-client.thephpleague.com/usage/
 *
 * @link https://dev.netatmo.com/resources/technical/guides/authentication/authorizationcode
 */
function login_netatmo() {

	global $provider;

	// Already logged in?
	if ( isset( $_GET['code'] ) && isset( $_GET['state'] ) ) {
		// return;
	}

	if ( ! isset( $_GET['code'] ) ) {

		// Generate unique session ID
		$_SESSION['state'] = md5( uniqid( '', false ) );

		// Fetch the authorization URL from the provider; this returns the
		// urlAuthorize option and generates and applies any necessary parameters
		// (e.g. state).
		$authorizationUrl = $provider->getAuthorizationUrl(
			array(
				'scope' => array( 'read_station' ),
			)
		);

		// Get the state generated for you and store it to the session.
		$_SESSION['oauth2state'] = $provider->getState();

		// Redirect the user to the authorization URL.
		header( 'Location: ' . $authorizationUrl );

		exit;
	} elseif ( empty( $_GET['state'] ) || empty( $_SESSION['oauth2state'] ) || $_GET['state'] !== $_SESSION['oauth2state'] ) {

		if ( isset( $_SESSION['oauth2state'] ) ) {
			unset( $_SESSION['oauth2state'] );
		}

		exit( 'Invalid state' );
	} else {
		try {
			get_access_token();
		} catch ( \League\OAuth2\Client\Provider\Exception\IdentityProviderException $e ) {
			echo '<pre>' . print_r( $e, true ) . '</pre>';

			// Failed to get the access token or user details.
			exit( $e->getMessage() );

		}
	}
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
 * Get weather forecast from YR.no.
 *
 * @see https://developer.yr.no/doc/GettingStarted/
 */
function get_yr_data() {

	// Initialize empty array for storing the forecast data to be returned.
	$forecast_json = array();

	// Define the YR.no URL.
	$yr_url = 'https://api.met.no/weatherapi/locationforecast/2.0/compact?altitude=' . ALTITUDE . '&lat=' . LATITUDE . '&lon=' . LONGITUDE;

	// Define User-Agent header for HTTP request as instructed by YR.
	$options = array(
		'http' => array(
			'user_agent' => 'netatmo-weather-display/1.1 github.com/mikkosiikaniemi/netatmo-weather-display',
		),
	);

	$context = stream_context_create( $options );

	// Just get the headers from YR to decice if it's ok to fetch data again.
	$yr_headers = get_headers( $yr_url, true, $context );

	// If YR 'Expires' header is in the past, get new fresh data. Store in session.
	if ( strtotime( $yr_headers['Expires'] ) < time() || empty( $_SESSION['forecast'] ) ) {
		$forecast_json                = file_get_contents( 'https://api.met.no/weatherapi/locationforecast/2.0/compact?altitude=60&lat=' . LATITUDE . '&lon=' . LONGITUDE, false, $context );
		$_SESSION['forecast']         = $forecast_json;
		$_SESSION['forecast_expires'] = strtotime( $yr_headers['Expires'] );
	} else {
		// Otherwise, use data stored in session.
		$forecast_json = $_SESSION['forecast'];
	}

	return $forecast_json;
}

/**
 * Render weather forecast from YR.no.
 */
function print_yr_forecast() {

	$output = '';

	// Get YR.no forecast data.
	$forecast_json = get_yr_data();

	// Decode the JSON.
	$forecast_decoded = json_decode( $forecast_json, true );

	// Get the right element from JSON.
	$time_series = $forecast_decoded['properties']['timeseries'];

	// Initialize empty array for forecast data to be processed.
	$forecast_data = array();

	// Loop through forecast data points.
	foreach ( $time_series as $index => $data ) {

		$datapoint_timestamp = strtotime( $data['time'] );
		$datapoint_human     = date( 'j.n.Y H:i', strtotime( $data['time'] ) );

		// Only process the next three days worth of data points.
		if ( $datapoint_timestamp > strtotime( '+3 day' ) ) {
			continue;
		}

		// Skip the data point if it's in the past.
		if ( $datapoint_timestamp < time() ) {
			continue;
		}

		/**
		 * Define default scope for forecast. Data returned by YR has built-in
		 * support for 1-hour, 6-hour and 12-hour steps.
		 */
		$forecast_scope = 'next_1_hours';

		if ( $datapoint_timestamp >= strtotime( 'tomorrow' ) ) {

			// For tomorrow's forecast and further, use 6-hour steps.
			$forecast_scope = 'next_6_hours';

			// Skip other than 6-hour stepped future data points.
			if ( false === in_array( (int) date( 'H', $datapoint_timestamp ), array( 2, 8, 14, 20 ) ) ) {
				continue;
			}
		}

		// Process and store the relevant data point measurements.
		$forecast_data[ $index ]['time']       = $datapoint_timestamp;
		$forecast_data[ $index ]['human_time'] = date( 'j.n.Y H:i', $datapoint_timestamp );
		$forecast_data[ $index ]['temp']       = $data['data']['instant']['details']['air_temperature'];

		if ( isset( $data['data'][ $forecast_scope ] ) ) {
			$forecast_data[ $index ]['symbol']        = $data['data'][ $forecast_scope ]['summary']['symbol_code'];
			$forecast_data[ $index ]['precipitation'] = number_format( $data['data'][ $forecast_scope ]['details']['precipitation_amount'], 2 );
		}
	}

	$weekday_names = array(
		'Mon' => 'Ma',
		'Tue' => 'Ti',
		'Wed' => 'Ke',
		'Thu' => 'To',
		'Fri' => 'Pe',
		'Sat' => 'La',
		'Sun' => 'Su',
	);

	// Map weather symbol names to SVG files. See subdir ./svg for numbers.
	$weather_symbols = array(
		'clearsky_day'       => 2,
		'fair_day'           => 4,
		'partlycloudy_day'   => 6,
		'cloudy'             => 7,
		'lightrain'          => 37,
		'rain'               => 38,
		'lightsleet'         => 47,
		'sleet'              => 48,
		'heavysleet'         => 49,
		'snow'               => 58,
		'clearsky_night'     => 101,
		'partlycloudy_night' => 104,
		'fog'                => 109,
	);

	$print_weekday            = false;
	$every_other_weekday      = false;
	$day_counter              = 1;
	$forecast_data_points     = 20;
	$previous_data_point_hour = date( 'H', time() );

	$output .= '<div id="forecast" class="padded">';

	foreach ( $forecast_data as $index => $data_point ) {

		// Print only defined amount of data points at maximum.
		if ( $forecast_data_points <= 0 ) {
			continue;
		}

		// Skip today's forecast late hours.
		if ( (int) date( 'H', time() ) < 22 && (int) date( 'H', $data_point['time'] ) > 22 ) {
			continue;
		}

		if ( date( 'H', $data_point['time'] ) < $previous_data_point_hour ) {
			$every_other_weekday = ! $every_other_weekday;
			$print_weekday       = true;
		}

		$previous_data_point_hour = date( 'H', $data_point['time'] );

		$output .= '<div class="forecast__data-point near-future';

		if ( $every_other_weekday ) {
			$output .= ' colored-bg';
		}

		$output .= '" data-time="' . $data_point['time'] . '">';

		if ( $print_weekday || array_key_first( $forecast_data ) === $index ) {
			$output .= '<span class="forecast__data-point--weekday">' . $weekday_names[ date( 'D', $data_point['time'] ) ] . '</span>';
			if ( 0 !== $index ) {
				$day_counter++;
			}
			$print_weekday = false;
		}

		$output .= '<span class="forecast__data-point--hour">' . date( 'H', $data_point['time'] ) . '</span>';

		$output .= '<svg class="weather-symbol symbol-' . $data_point['symbol'] . '">';
		$output .= '<use xlink:href="#' . $weather_symbols[ $data_point['symbol'] ] . '" /></svg>';

		$output .= '<span class="forecast__data-point--temp">' . round( $data_point['temp'] ) . '</span><span class="forecast__data-point--celcius">°</span>';

		// Precipitation output.
		$output .= '<table class="forecast__data-point--hmdy"><tbody><tr>';

		$precipitation_value = $data_point['precipitation'];

		if ( false === is_numeric( $precipitation_value ) || $precipitation_value <= 0 ) {
			$precipitation_value = 0;
		}

		$output .= '<td class="forecast__data-point--hmdy-bar" data-precipitation-value="' . $precipitation_value . '">';

		if ( $precipitation_value > 0 ) {
			$output .= '<div style="height:' . netatmo_calculate_precipitation_graph_height( $precipitation_value ) . 'px;"></div>';
		} else {
			$output .= '<div class="forecast__data-point--hmdy-bar__null"></div>';
		}

		$output .= '</td>';

		$output .= '</tr></tbody></table>';
		$output .= '<span class="forecast__data-point--hmdy-value" data-precipitation-subtotal="' . $precipitation_value . '">' . round( $precipitation_value, 1 ) . '</span>';

		$output .= '</div>' . PHP_EOL;

		$forecast_data_points--;
	}
	$output .= '</div>' . PHP_EOL;

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
