var SDC = require('statsd-client');

function buildMetricName(metricName) {
    return 'snooze.' + process.env.ENVIRONMENT + '.' + metricName;
}

function BBMetrics() {
    this.sdc = new SDC({ host: process.env.METRICS_HOST })
}

BBMetrics.prototype.incrMetric = function(metricName) {
    var incrementMetricName = buildMetricName(metricName);
    this.sdc.increment(incrementMetricName);
};

BBMetrics.prototype.timingMetric = function(metricName, startTime) {
    var timingMetricName = buildMetricName(metricName);
    this.sdc.timing(timingMetricName, startTime);
};

BBMetrics.prototype.gaugeMetric = function(metricName, value) {
    var gaugeMetricName = buildMetricName(metricName);
    this.sdc.gauge(gaugeMetricName, value);
};

BBMetrics.prototype.set = function(metricName, value) {
    var gaugeMetricName = buildMetricName(metricName);
    this.sdc.set(gaugeMetricName, value);
};

module.exports = new BBMetrics();