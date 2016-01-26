module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        lambda_invoke: {
            addTask: {
                options: {
                    file_name: "snooze.lambda.js",
                    event: "testEvents/add.json"
                }
            },
            runTask: {
                options: {
                    file_name: "snooze.lambda.js",
                    event: "testEvents/run.json"
                }
            },
            seekTask: {
                options: {
                    file_name: "snooze.lambda.js",
                    event: "testEvents/seek.json"
                }
            }
        },
        mochaTest: {
            test: {
                options: {
                    reporter: 'spec',
                    captureFile: 'results.txt',
                    quiet: false,
                    clearRequireCache: false
                },
                src: ['test/**/*.js']
            }
        }
    });
    grunt.loadNpmTasks('grunt-aws-lambda');
    grunt.loadNpmTasks('grunt-mocha-test');
};