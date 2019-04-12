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
	var indoor_temps_string = '';
	var indoor_temps;
	var indoor_modules = document.querySelectorAll('div[data-module-type="indoor"]');
	if (indoor_modules.length >= 1) {
		for (var k = 0; k < indoor_modules.length; k++) {
			if (k > 0) {
				indoor_temps_string += ',';
			}
			indoor_temps_string += indoor_modules[k].getAttribute('data-series');
		}
		indoor_temps = indoor_temps_string.split(',').map(Number);
	}

	// Put all outdoor temperatures to an array
	var outdoor_temps_string = '';
	var outdoor_temps;
	var outdoor_modules = document.querySelectorAll('div[data-module-type="outdoor"]');
	if (outdoor_modules.length >= 1) {
		for (var l = 0; l < outdoor_modules.length; l++) {
			if (l > 0) {
				outdoor_temps_string += ',';
			}
			outdoor_temps_string += outdoor_modules[l].getAttribute('data-series');
		}
		outdoor_temps = outdoor_temps_string.split(',').map(Number);
	}

	var placeholders = document.getElementsByClassName('ct-chart');

	if (placeholders.length >= 1) {

		for (i = 0; i < placeholders.length; i++) {
			labels_array = placeholders[i].getAttribute('data-labels').split(',');
			series_array = placeholders[i].getAttribute('data-series').split(',');

			// Find the highest/lowest temperatures and set them as Y-axis options
			if (placeholders[i].getAttribute('data-module-type') === 'indoor') {
				axisY_options = {
					low: Math.floor(array_min(indoor_temps)),
					high: Math.ceil(array_max(indoor_temps)),
					scaleMinSpace: 10,
					onlyInteger: true
				};
			} else if (placeholders[i].getAttribute('data-module-type') === 'outdoor') {
				axisY_options = {
					low: Math.floor(array_min(outdoor_temps)),
					high: Math.ceil(array_max(outdoor_temps)),
					scaleMinSpace: 10,
					onlyInteger: true
				};
			}

			previous_hour_value = null;

			new Chartist.Line('#' + placeholders[i].getAttribute('id'), {
				labels: labels_array,
				series: [series_array]
			},
			{
				axisX: {
					labelInterpolationFnc: function (value, index) {
						var hour_value = moment.unix(value).format('HH');

						if (hour_value !== previous_hour_value) {
							previous_hour_value = hour_value;
							return hour_value;
						} else {
							return null;
						}

					}
				},
				fullWidth: true,
				axisY: axisY_options,
				showPoint: false,
				showArea: true,
			});
		}
	}
}
