var fs = require('fs');
var gulp = require('gulp');
var uglify = require("uglify-js");

var uglified = uglify.minify([
	'node_modules/flot/source/jquery.js',
	'node_modules/flot/source/jquery.flot.js',
	'node_modules/flot/source/jquery.flot.time.js',
	'node_modules/flot/source/jquery.flot.threshold.js',
	'node_modules/flot/source/jquery.flot.resize.js',
	'src/js/netatmo.js'
]);



gulp.task( 'compress', function() {
	fs.writeFile('netatmo.min.js', uglified.code, function (err) {
		if (err) {
			console.log(err);
		} else {
			console.log("Script generated and saved:", 'netatmo.min.js');
		}
	});
});
