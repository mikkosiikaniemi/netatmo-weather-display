var gulp = require('gulp');
var svgstore = require('gulp-svgstore');
var svgmin = require('gulp-svgmin');
var path = require('path');
var rename = require('gulp-rename');
var cheerio = require('gulp-cheerio');

gulp.task('svgstore', function () {
	return gulp
		.src('svg/yr/*.svg')
		/*
		.pipe(svgmin(function (file) {
			var prefix = path.basename(file.relative, path.extname(file.relative));
			return {
				plugins: [{
					cleanupIDs: {
						prefix: prefix + '-',
						minify: true
					}
				}]
			}
		}))
		*/
		.pipe(svgstore({ inlineSvg: true }))
		.pipe(cheerio({
			run: function ($) {
				$('svg').attr('style', 'display:none');
			},
			parserOptions: { xmlMode: true }
		}))
		.pipe(rename('svg-symbols-yr.svg'))
		.pipe(gulp.dest('.'));
});

gulp.task('default', gulp.series('svgstore'));
