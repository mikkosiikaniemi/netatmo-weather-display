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

		var currentDateString = currentWeekDay + ' ' + currentDay + '.' + currentMonth + '.';
		var currentTimeString = currentHours + ":" + currentMinutes + ":" + currentSeconds;

		document.getElementById('date').innerText = currentDateString;
		document.getElementById('time').innerText = currentTimeString;
	}

	function updateTemperatures() {
		updateInProgress = true;
		var placeholder = document.getElementById('temperatures-and-forecast');
		var updateButton = document.getElementById('refresh');

		updateButton.classList.add('updating');

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
				placeholder.innerHTML = 'Request status != 200: ' + request.status + request.response;
				drawCharts();
				//console.log('server error');
			}
			updateInProgress = false;
			//clearInterval( tickUpdate );
			updateButton.classList.remove('updating');
		};

		request.onerror = function () {
			placeholder.innerHTML = 'Request error: ' + request.status + request.response;
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

	/**
	 * Find the smallest value in array. If value is greater than "floor"
	 * parameter, return floor instead.
	 * Optional multiplier can be used to scale the value.
	 */
	function array_min(values, floor, multiplier) {
		// Remove null values from temperatures first
		//var noNullsArray = array.filter(removeNulls);
		//var min = Math.min.apply(Math, noNullsArray);
		multiplier = (typeof multiplier !== 'undefined') ? multiplier : 1;
		var min = Math.min.apply(Math, values);
		if (min > floor) {
			return floor;
		} else {
			return min * multiplier;
		}
	}

	/**
	 * Find the largest value in array. If value is smaller than "ceil"
	 * parameter, return ceil instead.
	 * Optional multiplier can be used to scale up if greater than "ceil".
	 */
	function array_max(values, ceil, multiplier) {
		multiplier = (typeof multiplier !== 'undefined') ? multiplier : 1;
		var max = Math.max.apply(Math, values);
		if (max < ceil) {
			return ceil;
		} else {
			return max * multiplier;
		}
	}

	function drawCharts() {

		var progress_bar = $('.update-timer__bar');

		var now = new Date();
		var secondsPassedToday = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
		var secondsInADay = 24 * 60 * 60;
		var todayPercentage = secondsPassedToday / secondsInADay * 100;

		progress_bar.width(todayPercentage + '%');

		var rain_data_points, n;

		// Put all rain measures to individual array
		var rain_measures = [];
		var outdoor_modules = document.querySelectorAll('div[data-module-type="outdoor"]');
		if (outdoor_modules.length >= 1) {
			for (var m = 0; m < outdoor_modules.length; m++) {
				rain_data_points = JSON.parse(outdoor_modules[m].getAttribute('data-rain-points'));
				if (rain_data_points) {
					for (n = 0; n < rain_data_points.length; n++) {
						rain_measures.push(rain_data_points[n][1]);
					}
				}
			}
		}

		var outdoor_options = {};

		var indoor_modules = document.querySelectorAll('div[data-module-type="indoor"]');
		var indoor_min_temp = null;
		var indoor_max_temp = null;
		var indoor_min_hmdy = null;
		var indoor_max_hmdy = null;

		if (indoor_modules.length >= 1) {
			indoor_min_temp = Math.floor( indoor_modules[0].getAttribute('data-min-temp') );
			indoor_max_temp = Math.ceil(indoor_modules[0].getAttribute('data-max-temp'));

			indoor_min_hmdy = Math.floor( indoor_modules[0].getAttribute('data-min-hmdy') );
			indoor_max_hmdy = Math.ceil( indoor_modules[0].getAttribute('data-max-hmdy') );

			for (var o = 0; o < indoor_modules.length; o++) {
				if( Math.floor( indoor_modules[o].getAttribute('data-min-temp') ) < indoor_min_temp ) {
					indoor_min_temp = Math.floor( indoor_modules[o].getAttribute('data-min-temp') );
				}
				if( Math.ceil( indoor_modules[o].getAttribute('data-max-temp') ) > indoor_max_temp ) {
					indoor_max_temp = Math.ceil( indoor_modules[o].getAttribute('data-max-temp') );
				}

				if( Math.floor( indoor_modules[o].getAttribute('data-min-hmdy') ) < indoor_min_hmdy ) {
					indoor_min_hmdy = Math.floor( indoor_modules[o].getAttribute('data-min-hmdy') );
				}
				if( Math.ceil( indoor_modules[o].getAttribute('data-max-hmdy') ) > indoor_max_hmdy ) {
					indoor_max_hmdy = Math.ceil( indoor_modules[o].getAttribute('data-max-hmdy') );
				}
			}
		}

		if ( indoor_max_temp - indoor_min_temp < 3 ) {
			indoor_min_temp = indoor_min_temp - 1.5;
			indoor_max_temp = indoor_max_temp + 1.5;
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
			var humidity_data = $(element).data('humidity');
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
						low: Math.round( min_temp - ( outdoor_normalization - outdoor_temp_diff )/2 ),
						high: Math.round( max_temp + ( outdoor_normalization - outdoor_temp_diff )/2 ),
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
				family: "HelveticaNeue, sans-serif",
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
				line_color = 'rgb(200, 20, 30)';
				//yaxis_options.tickSize = 1;
				yaxis_options.minTickSize = 2;
				xaxis_options.ticks = 12;
				data_series = [ temperature_data_recent, temperature_data_further ];
			}
			if (element_type === 'indoor') {
				yaxis_options.min = indoor_min_temp;
				yaxis_options.max = indoor_max_temp;
				line_color = 'rgb(200, 20, 30)';
				yaxis_options.tickSize = null;
				yaxis_options.minTickSize = 2;
				xaxis_options.ticks = 6;
			}

			if( element_type === 'outdoor' ) {
				$.plot(element_id, [
					{
						data: humidity_data,
						color: 'rgba(41,171,226,0.2)',
						yaxis: 3,
						shadowSize: 0,
						lines: {
							show: true,
							fill: false,
							lineWidth: 2,
							borderWidth: 1,
						}
					},
					{
						data: temperature_data_further,
						color: "rgba(200, 20, 30, 0.3)",
						threshold: {
							below: 0,
							color: 'rgba(41,171,226,0.2)',
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
							color: 'rgb(41,171,226)',
						},
						shadowSize: 0,
						lines: {
							show: true,
							fill: true,
							fillColor: { colors: [{ opacity: 0.2 }, { opacity: 0.5 }] }
							//fillColor: { colors: [ 'rgba(0,0,0,0)', 'red'] }
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
							max: array_max( rain_measures, 3, 4 ),
							tickDecimals: 1,
							font: font_spec,
							position: 'right',
							tickColor: 'rgba(240,240,240,0.2)',
							alignTicksWithAxis: 1
						},
						{              // options for the third y-axis
							min: 0,
							max: 100,
							tickDecimals: 0,
							font: font_spec,
							position: 'right',
							tickColor: 'rgba(240,240,240,0.2)',
							alignTicksWithAxis: 1,
							minTickSize: 5,
						}
					],
					grid: {
						borderWidth: 0,
						color: '#666666',
						backgroundColor: 'rgba(240,240,240,0.1)',
						//markings: [ { xaxis: { from: startOfDay, to: startOfDay }, color: "rgba(41,171,226,.2" } ]
					},
				});
			}

			if( element_type === 'indoor' ) {
				$.plot(element_id, [
					{
						data: humidity_data,
						color: 'rgba(41,171,226,0.2)',
						yaxis: 2,
						shadowSize: 0,
						lines: {
							show: true,
							fill: false,
							lineWidth: 2,
							borderWidth: 1,
						}
					},
					{
						data: temperature_data_further,
						color: 'rgba(200, 20, 30,0.2)',
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
							color: "rgb(41,171,226)"
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
					yaxes: [
						yaxis_options, // options for the first y-axis
						{              // options for the second y-axis
							min: indoor_min_hmdy - 1,
							max: indoor_max_hmdy * 1.75,
							tickDecimals: 0,
							font: font_spec,
							position: 'right',
							tickColor: 'rgba(240,240,240,0.2)',
							alignTicksWithAxis: 1,
							minTickSize: 5,
						}
					],
					grid: {
						borderWidth: 0,
						color: '#666666',
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

		$('#dark-mode').click(function () {
			$('body').toggleClass('dark-mode');
			if ($('body').hasClass('dark-mode')) {
				$('[data-class="dark-mode"]').show();
				$('[data-class="light-mode"]').hide();
			} else {
				$('[data-class="dark-mode"]').hide();
				$('[data-class="light-mode"]').show();
			}
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
