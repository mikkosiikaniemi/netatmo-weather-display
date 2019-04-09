var weekDays = [ "Sunnuntai", "Maanantai", "Tiistai", "Keskiviikko", "Torstai", "Perjantai", "Lauantai" ];
var months = [ 'Tammikuu', 'Helmikuu' ];

updateClock();

setInterval( 'updateClock()', 1000 );

function updateClock() {
	var currentTime = new Date ( );

	var currentDay = currentTime.getDate();
	var currentMonthName = months[ currentTime.getMonth() ];
	var currentMonth = currentTime.getMonth() + 1;

	var currentYear = currentTime.getFullYear();
	var currentWeekDay = weekDays[ currentTime.getDay() ];

	var currentHours = currentTime.getHours ( );
	var currentMinutes = currentTime.getMinutes ( );
	var currentSeconds = currentTime.getSeconds ( );
	currentMinutes = ( currentMinutes < 10 ? "0" : "" ) + currentMinutes;
	currentSeconds = ( currentSeconds < 10 ? "0" : "" ) + currentSeconds;

	var currentTimeString = currentWeekDay + ' ' + currentDay + '.' + currentMonth + '.' + currentYear + ' ' + currentHours + ":" + currentMinutes + ":" + currentSeconds;
	document.getElementById("timer").firstChild.nodeValue = currentTimeString;
}
