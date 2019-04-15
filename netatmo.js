var weekDays = ["Sunnuntai", "Maanantai", "Tiistai", "Keskiviikko", "Torstai", "Perjantai", "Lauantai"];

updateClock();

drawCharts();

setInterval(updateClock, 500);
setInterval(updateTemperatures, 3 * 60000);

function updateClock() {
	var currentTime = new Date();

	var currentDay = currentTime.getDate();
	//var currentMonthName = months[ currentTime.getMonth() ];
	var currentMonth = currentTime.getMonth() + 1;

	var currentYear = currentTime.getFullYear();
	var currentWeekDay = weekDays[currentTime.getDay()];

	var currentHours = currentTime.getHours();
	var currentMinutes = currentTime.getMinutes();
	var currentSeconds = currentTime.getSeconds();
	currentMinutes = (currentMinutes < 10 ? "0" : "") + currentMinutes;
	currentSeconds = (currentSeconds < 10 ? "0" : "") + currentSeconds;

	var currentTimeString = currentWeekDay + ' ' + currentDay + '.' + currentMonth + '.' + currentYear + ' ' + currentHours + ":" + currentMinutes + ":" + currentSeconds;
	document.getElementById("timer").firstChild.nodeValue = currentTimeString;
}

function updateTemperatures() {
	var placeholder = document.getElementById('temperatures');

	var request = new XMLHttpRequest();
	// Make an AJAX request to handler PHP file
	request.open('GET', 'temperatures.php', true);
	request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');

	request.onload = function () {
		if (request.status === 200) {
			placeholder.innerHTML = request.response;
			drawCharts();
		}
		else {
			console.log('server error');
		}
	};

	request.onerror = function () {
		console.log('something went wrong');
	};

	request.send();
}

function array_min(array) {
	return Math.min.apply(Math, array);
}

function array_max(array) {
	return Math.max.apply(Math, array);
}

function drawCharts() {

	// Put all indoor temperatures to an array
	var indoor_temps = [];
	var indoor_modules = document.querySelectorAll('div[data-module-type="indoor"]');
	if (indoor_modules.length >= 1) {
		for (var k = 0; k < indoor_modules.length; k++) {
			data_points = JSON.parse( indoor_modules[k].getAttribute('data-points') );
			for( var l = 0; l < data_points.length; l++ ) {
				indoor_temps.push( data_points[l][1] );
			}
		}
	}

	// Put all outdoor temperatures to an array
	var outdoor_temps = [];
	var outdoor_modules = document.querySelectorAll('div[data-module-type="outdoor"]');
	if (outdoor_modules.length >= 1) {
		for (var m = 0; m < outdoor_modules.length; m++) {
			data_points = JSON.parse( outdoor_modules[m].getAttribute('data-points') );
			for( var n = 0; n < data_points.length; n++ ) {
				outdoor_temps.push( data_points[n][1] );
			}
		}
	}

	// Find the highest/lowest temperatures and set them as Y-axis options
	outdoor_options = {
		low: Math.floor(array_min(outdoor_temps)),
		high: Math.ceil(array_max(outdoor_temps)),
	};

	indoor_options = {
		low: Math.floor(array_min(indoor_temps)),
		high: Math.ceil(array_max(indoor_temps)),
	};

	var min_temp, max_temp, line_color;

	$('.ct-chart').each( function ( index, element ) {
		element_id = '#' + $(element).attr('id');
		element_data = $(element).data('points');
		element_type = $(element).data('module-type');
		//console.log( element_id, element_data );

		if( element_type === 'outdoor' ) {
			min_temp = outdoor_options.low;
			max_temp = outdoor_options.high;
			line_color = '#0000ff';
		}
		if( element_type === 'indoor' ) {
			min_temp = indoor_options.low;
			max_temp = indoor_options.high;
			line_color = '#ff0000';
		}

		$.plot( element_id, [ {
			data: element_data,
			color: line_color,
			shadowSize: 0,
			lines: {
				show: true,
				fill: true,
			}
		} ], {
			yaxis: {
				position: 'right',
				min: min_temp,
				max: max_temp
			},
			xaxis: {
				mode: 'time',
				timeformat: '%H',
				timezone: 'browser',
				twelveHourClock: false,
				timebase: 'seconds',
			}
		} );
	});
}
