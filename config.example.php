<?php
// Netatmo dev app credentials.
// See https://dev.netatmo.com/apps/
define( 'CLIENT_ID', '' );
define( 'CLIENT_SECRET', '' );

// Your Netatmo station's main module MAC address.
// See https://helpcenter.netatmo.com/en-us/smart-home-weather-station-and-accessories/product-interactions/how-do-i-find-my-products-serial-number-or-its-mac-address
define( 'STATION_MAC', '' );

// Your latitude and longitude.
// This is for weather forecast and sunrise/sunset times.
define( 'LATITUDE', '' );
define( 'LONGITUDE', '' );

// Define the local redirect URL. Probably no need to touch.
define( 'LOCAL_URL', "https://$_SERVER[HTTP_HOST]$_SERVER[REQUEST_URI]" );
