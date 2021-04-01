(function ($) {
	'use strict';

	var weekDays = ["Sunnuntai", "Maanantai", "Tiistai", "Keskiviikko", "Torstai", "Perjantai", "Lauantai"];
	//var weekDays = ["Su", "Ma", "Ti", "Ke", "To", "Pe", "La"];

	var updateInterval = netatmo.update_interval;
	var updateInProgress = false;

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

		var currentDateString = currentWeekDay + ' ' + currentDay + '.' + currentMonth + '.' + currentYear;
		var currentTimeString = currentHours + ":" + currentMinutes + ":" + currentSeconds;
		document.getElementsByClassName('date-and-time')[0].innerHTML = '<a href="#date-and-time" class="date">' + currentDateString + '</a><span class="time">' + currentTimeString + '</span>';
	}

	function updateTemperatures() {
		updateInProgress = true;
		var placeholder = document.getElementById('temperatures-and-forecast');
		var updateButton = document.getElementById('refresh');

		updateButton.innerHTML = 'Päivitetään... <span id="updateTimer">0</span>';
		var updateTicks = 1;
		var timer = document.getElementById('updateTimer');
		var tickUpdate = setInterval( function() {
			timer.innerHTML = updateTicks;
			updateTicks += 1;
		}, 1000 );

		var request = new XMLHttpRequest();
		// Make an AJAX request to handler PHP file
		request.open('GET', 'temperatures.php', true);
		request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');

		request.onload = function () {
			if (request.status === 200) {
				placeholder.innerHTML = request.response;
				drawCharts();
				//console.log('Temperatures updated.');
			}
			else {
				placeholder.innerHTML = 'bb' + request.status + request.response;
				//console.log('server error');
			}
			updateInProgress = false;
			clearInterval( tickUpdate );
			updateButton.innerHTML = "Päivitä";
		};

		request.onerror = function () {
			placeholder.innerHTML = 'cc' + request.status + request.response;
			//console.log('something went wrong');
		};

		request.send();
	}

	function updateTimeDifferences() {
		var time_difference_placeholders = document.getElementsByClassName('module__details--time');
		for (var i = 0; i < time_difference_placeholders.length; i++) {
			var time_measured = time_difference_placeholders[i].getAttribute('data-time-measured') * 1000;
			if( i === 1 && updateInProgress === false && Math.floor( new Date() / 1000 ) - time_difference_placeholders[i].getAttribute('data-time-measured') > updateInterval ) {
				//console.log( 'Interval update triggered.');
				updateTemperatures();
			}
			time_difference_placeholders[i].innerHTML = timeSince( time_measured );
		}
	}

	function timeSince(timestamp) {

		var seconds = Math.floor( ( new Date() - timestamp ) / 1000 );
		var interval = Math.floor(seconds / 31536000);

		if (interval > 1) {
			return interval + " vuotta";
		}
		interval = Math.floor(seconds / 2592000);
		if (interval > 1) {
			return interval + " kuukautta";
		}
		interval = Math.floor(seconds / 86400);
		if (interval > 1) {
			return interval + " päivää";
		}
		interval = Math.floor(seconds / 3600);
		if (interval > 1) {
			return interval + " tuntia";
		}
		interval = Math.floor(seconds / 60);
		if (interval > 1) {
			return interval + " minuuttia";
		}
		if (interval >= 1) {
			return "Minuutti";
		}
		return Math.floor(seconds) + " sekuntia";
	}

	function removeNulls(value) {
		return value !== null;
	}

	function array_min(array) {
		// Remove null values from temperatures first
		var noNullsArray = array.filter(removeNulls);
		return Math.min.apply(Math, noNullsArray);
	}

	function array_max(array) {
		return Math.max.apply(Math, array);
	}

	function drawCharts() {

		var progress_bar = $('.update-timer__bar');

		progress_bar.stop().width(0);
		progress_bar.animate({
			width: '100%',
		}, updateInterval * 1000, 'linear' );

		var rain_data_points, n;

		// Put all rain measures to individual array
		var rain_measures = [];
		var outdoor_modules = document.querySelectorAll('div[data-module-type="outdoor"]');
		if (outdoor_modules.length >= 1) {
			for (var m = 0; m < outdoor_modules.length; m++) {
				rain_data_points = JSON.parse(outdoor_modules[m].getAttribute('data-rain-points'));
				for (n = 0; n < rain_data_points.length; n++) {
					rain_measures.push(rain_data_points[n][1]);
				}
			}
		}

		var outdoor_options = {};

		var indoor_modules = document.querySelectorAll('div[data-module-type="indoor"]');
		var indoor_min_temp = null;
		var indoor_max_temp = null;

		if (indoor_modules.length >= 1) {
			indoor_min_temp = parseFloat( indoor_modules[0].getAttribute('data-min-temp') );
			indoor_max_temp = parseFloat( indoor_modules[0].getAttribute('data-max-temp') );

			for (var o = 0; o < indoor_modules.length; o++) {
				if( parseFloat( indoor_modules[o].getAttribute('data-min-temp') ) < indoor_min_temp ) {
					indoor_min_temp = parseFloat( indoor_modules[o].getAttribute('data-min-temp') );
				}
				if( parseFloat( indoor_modules[o].getAttribute('data-max-temp') ) > indoor_max_temp ) {
					indoor_max_temp = parseFloat( indoor_modules[o].getAttribute('data-max-temp') );
				}
			}
		}

		if ( indoor_max_temp - indoor_min_temp < 4 ) {
			indoor_min_temp = indoor_min_temp - 1;
			indoor_max_temp = indoor_max_temp + 1;
		} else {
			indoor_min_temp = indoor_min_temp - 0.5;
			indoor_max_temp = indoor_max_temp + 0.5;
		}

		var line_color, xaxis_options, yaxis_options, font_spec, data_series;

		var d = new Date();
		var startOfDay = d.setUTCHours(0,0,0,0);
		startOfDay = startOfDay + d.getTimezoneOffset() * 60 * 1000;

		$('.flot-chart').each(function (index, element) {
			var element_id = '#' + $(element).attr('id');
			var temperature_data_recent = $(element).data('points');
			var temperature_data_further = $(element).data('further-points');
			var rain_data = $(element).data('rain-points');
			var humidity = $(element).data('rain-points');
			var element_type = $(element).data('module-type');

			var min_temp = $(element).data('min-temp');
			var max_temp = $(element).data('max-temp');

			if (element_type === 'outdoor') {
				var outdoor_temp_diff = max_temp - min_temp;
				var outdoor_normalization = 15; // Normalize to this diff, i.e. the difference between chart min/max
				if ( outdoor_temp_diff > ( outdoor_normalization - 2) ) {
					//console.log( 'Outdoor temperature graph normalized, option A.');
					outdoor_options = {
						low: min_temp - 1,
						high: max_temp + 1,
					};
				} else {
					//console.log( 'Outdoor temperature graph normalized, option B.');
					outdoor_options = {
						low: min_temp - ( outdoor_normalization - outdoor_temp_diff )/2,
						high: max_temp + ( outdoor_normalization - outdoor_temp_diff )/2,
					};
				}
				if ( min_temp >= 0) {
					outdoor_options.low = 0;
				}

				if ( max_temp <= 0 ) {
					outdoor_options.high = 0;
				}
			}

			font_spec = {
				size: 11,
				lineHeight: 13,
				family: "HelveticaNeue",
				color: "#888888"
			};

			xaxis_options = {
				mode: 'time',
				timeformat: '%H',
				timezone: 'browser',
				twelveHourClock: false,
				timebase: 'seconds',
				font: font_spec,
			};

			yaxis_options = {
				font: font_spec,
				tickDecimals: 0,
				showTicks: true,
				showMinorTicks: true
			};

			if (element_type === 'outdoor') {
				yaxis_options.min = outdoor_options.low;
				yaxis_options.max = outdoor_options.high;
				line_color = '#29abe2';
				//yaxis_options.tickSize = 1;
				yaxis_options.minTickSize = 2;
				xaxis_options.ticks = 12;
				data_series = [ temperature_data_recent, temperature_data_further ];
			}
			if (element_type === 'indoor') {
				yaxis_options.min = indoor_min_temp;
				yaxis_options.max = indoor_max_temp;
				line_color = '#29abe2';
				yaxis_options.tickSize = null;
				xaxis_options.ticks = 6;
			}

			if( element_type === 'outdoor' ) {
				$.plot(element_id, [
					{
						data: temperature_data_further,
						color: 'rgba(41,171,226,0.2)',
						threshold: {
							below: 0,
							color: "rgba(200, 20, 30, 0.3)"
						},
						shadowSize: 0,
						lines: {
							show: true,
							fill: false,
						}
					},
					{
						data: temperature_data_recent,
						color: line_color,
						threshold: {
							below: 0,
							color: "rgb(200, 20, 30)"
						},
						shadowSize: 0,
						lines: {
							show: true,
							fill: true,
							fillColor: { colors: [{ opacity: 0.2 }, { opacity: 0.5 }] }
						}
					},
					{
						data: rain_data,
						color: 'rgba(24,24,24,0.9)',
						yaxis: 2,
						bars: {
							show: true,
							fill: true,
							barWidth: 20 * 60 * 1000,
							lineWidth: 1,
							shadowSize: 0,
							borderWidth: 1,
							align: 'center',
							fillColor: 'rgba(41,171,226,0.7)',
						}
					}
				],
				{
					xaxis: xaxis_options,
					yaxes: [
						yaxis_options, // options for the first y-axis
						{              // options for the second y-axis
							min: 0,
							max: array_max( rain_measures ) * 4,
							tickDecimals: 1,
							font: font_spec,
							position: 'right',
							tickColor: 'rgba(240,240,240,0.2)',
							alignTicksWithAxis: 1
						}
					],
					grid: {
						borderWidth: 0,
						color: 'rgba(41,171,226,0.7)',
						backgroundColor: 'rgba(240,240,240,0.1)',
						//markings: [ { xaxis: { from: startOfDay, to: startOfDay }, color: "rgba(41,171,226,.2" } ]
					},
				});
			}

			if( element_type === 'indoor' ) {
				$.plot(element_id, [
					{
						data: temperature_data_further,
						color: 'rgba(41,171,226,0.2)',
						shadowSize: 0,
						lines: {
							show: true,
							fill: false,
						}
					},
					{
						data: temperature_data_recent,
						color: line_color,
						threshold: {
							below: 0,
							color: "rgb(200, 20, 30)"
						},
						shadowSize: 0,
						lines: {
							show: true,
							fill: true,
							fillColor: { colors: [{ opacity: 0.2 }, { opacity: 0.5 }] }
						}
					},
				],
				{
					xaxis: xaxis_options,
					yaxis: yaxis_options,
					grid: {
						borderWidth: 0,
						color: 'rgba(41,171,226,0.7)',
						backgroundColor: 'rgba(240,240,240,0.1)',
						//markings: [ { xaxis: { from: startOfDay, to: startOfDay }, color: "rgba(41,171,226,.2" } ]
					},
				});
			}
		});
	}

	$(function () {

		updateClock();

		drawCharts();

		$('#refresh').click( function() {
			//console.log('Refresh called.');
			updateTemperatures();
		});

		setInterval(updateClock, 1000);
		//setInterval(updateTemperatures, netatmo.update_interval * 1000);
		setInterval(updateTimeDifferences, 30000);

		// Reload the whole page at interval
		setTimeout( function() {
			location.reload();
		}, 3 * 60 * 60 * 1000 );


	});

})(jQuery);
