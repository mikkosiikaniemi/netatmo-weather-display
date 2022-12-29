<?php
// Netatmo dev app credentials.
// See https://dev.netatmo.com/apps/
$client_id     = '';
$client_secret = '';

// Your Netatmo station's main module MAC address.
// See https://helpcenter.netatmo.com/en-us/smart-home-weather-station-and-accessories/product-interactions/how-do-i-find-my-products-serial-number-or-its-mac-address
$station_mac = '';

// Your latitude and longitude.
$latitude = '62.7945';
$longitude = '22.8282';

// Define the local redirect URL.
$local_url = "https://$_SERVER[HTTP_HOST]$_SERVER[REQUEST_URI]";
