module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        mochaTest: {
            test: {
                options: {
                    reporter: 'spec',
                    captureFile: 'results.txt',
                    quiet: false,
                    clearRequireCache: false
                },
                src: ['spec/**/*.js']
            }
        },
        mocha_istanbul: {
            coverage: {
                src: 'spec',
                options: {
                    coverageFolder: './coverage',
                    mask: '*.js',
                    root: '/'
                }
            }
        }
    });
    grunt.loadNpmTasks('grunt-aws-lambda');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('mocha_istanbul');
    grunt.loadNpmTasks('grunt-mocha-istanbul');
};