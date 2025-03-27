const config = require('./config');
const os = require('os');

let lastCpuUsage = process.cpuUsage();
let lastTime = process.hrtime();

let totalEndpointLatency = 0;
let endpointRequestCount = 0;
let totalPizzaCreationLatency = 0;
let pizzaCreationCount = 0;

const metrics = {
    requestsByMethod: {
        GET: 0,
        POST: 0,
        PUT: 0,
        DELETE: 0,
    },
    activeUsers: 0,
    authAttempts: {
        success: 0,
        failure: 0,
    },
    system: {
        memoryPercentage: 0,
        cpuPercentage: 0,
    },
    pizzas: {
        sold: 0,
        creationFailures: 0,
        revenue: 0,
    },
    latency: {
        endpointLatency: 0,
        pizzaCreationLatency: 0,
    },
};

function requestTracker() {
    return (req, res, next) => {
        const startTime = process.hrtime();
        metrics.requestsByMethod[req.method] += 1;

        // When response finishes, calculate elapsed time in milliseconds
        res.on('finish', () => {
            const diff = process.hrtime(startTime);
            const latencyMs = (diff[0] * 1e9 + diff[1]) / 1e6;
            totalEndpointLatency += latencyMs;
            endpointRequestCount++;
        });

        next();
    };
};

function incrementActiveUsers() {
    metrics.activeUsers += 1;
}

function decrementActiveUsers() {
    if (metrics.activeUsers > 0) {
        metrics.activeUsers -= 1;
    }
}

function trackAuthSuccess() {
    metrics.authAttempts.success += 1;
}

function trackAuthFailure() {
    metrics.authAttempts.failure += 1;
}

function trackPizzaSold() {
    metrics.pizzas.sold += 1;
}

function trackPizzaCreationFailure() {
    metrics.pizzas.creationFailures += 1;
}

function trackPizzaRevenue(price) {
    metrics.pizzas.revenue += price;
}

function getAverageLatencyAndReset(total, count) {
    if (count === 0) return 0;
    const avg = total / count;
    return avg;
}

function trackPizzaCreationLatency(latencyMs) {
    totalPizzaCreationLatency += latencyMs;
    pizzaCreationCount++;
}

function resetLatencyTrackers() {
    totalEndpointLatency = 0;
    endpointRequestCount = 0;
    totalPizzaCreationLatency = 0;
    pizzaCreationCount = 0;
}

// This will periodically send metrics to Grafana
setInterval(() => {

    // requestsByMethod
    Object.keys(metrics.requestsByMethod).forEach((method) => {
        sendMetricToGrafana('methods', metrics.requestsByMethod[method], { method });
    });

    // activeUsers
    sendMetricToGrafana('activeUsers', metrics.activeUsers, {});

    // authAttempts
    sendMetricToGrafana('authAttemps', metrics.authAttempts.success, { status: 'success' });
    sendMetricToGrafana('authAttemps', metrics.authAttempts.failure, { status: 'failure' });

    // system cpuPercentage
    metrics.system.cpuPercentage = getCpuUsagePercentage();
    sendMetricToGrafana('cpuPercentage', metrics.system.cpuPercentage, {});

    // system memoryPercentage
    metrics.system.memoryPercentage = getMemoryUsagePercentage();
    sendMetricToGrafana('memoryPercentage', metrics.system.memoryPercentage, {});

    // pizzas sold, creationFailures, revenue
    Object.keys(metrics.pizzas).forEach((pizzaMetric) => {
        sendMetricToGrafana('pizzas', metrics.pizzas[pizzaMetric], { pizzaMetric });
    });

    // latency endpoint
    const avgEndpointLatency = getAverageLatencyAndReset(totalEndpointLatency, endpointRequestCount);
    metrics.latency.endpointLatency = avgEndpointLatency;
    sendMetricToGrafana('endpointLatency', avgEndpointLatency, {});

    // latency pizzaCreation
    const avgPizzaLatency = getAverageLatencyAndReset(totalPizzaCreationLatency, pizzaCreationCount);
    metrics.latency.pizzaCreationLatency = avgPizzaLatency;
    sendMetricToGrafana('endpointPizzaCreationLatency', avgPizzaLatency, {});

    resetLatencyTrackers();

}, 10000);

function getCpuUsagePercentage() {
    const currentCPUUsage = process.cpuUsage();
    const currentTime = process.hrtime();

    // Calculate elapsed microseconds in user and system mode
    const userDiff = currentCPUUsage.user - lastCpuUsage.user;       // microseconds
    const systemDiff = currentCPUUsage.system - lastCpuUsage.system; // microseconds

    // Calculate elapsed time in microseconds
    const hrSecDiff = currentTime[0] - lastTime[0];    // seconds
    const hrNanoDiff = currentTime[1] - lastTime[1];   // nanoseconds
    const elapsedMicros = (hrSecDiff * 1e9 + hrNanoDiff) / 1000;

    // Calculate percentage: (CPU time / elapsed time) * 100
    const cpuPercent = ((userDiff + systemDiff) / elapsedMicros) * 100;

    // Update our "last" values
    lastCpuUsage = currentCPUUsage;
    lastTime = currentTime;

    return Math.round(cpuPercent);
}

function getMemoryUsagePercentage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = ((usedMemory / totalMemory) * 100);
    return memoryUsage.toFixed(1);
}

function sendMetricToGrafana(metricName, metricValue, attributes) {
    attributes = { ...attributes, source: config.source };

    const metric = {
        resourceMetrics: [
            {
                scopeMetrics: [
                    {
                        metrics: [
                            {
                                name: metricName,
                                unit: '1',
                                sum: {
                                    dataPoints: [
                                        {
                                            asDouble: metricValue,
                                            timeUnixNano: Date.now() * 1000000,
                                            attributes: [],
                                        },
                                    ],
                                    aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
                                    isMonotonic: true,
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    };

    Object.keys(attributes).forEach((key) => {
        metric.resourceMetrics[0].scopeMetrics[0].metrics[0].sum.dataPoints[0].attributes.push({
            key: key,
            value: { stringValue: attributes[key] },
        });
    });

    fetch(`${config.metrics.url}`, {
        method: 'POST',
        body: JSON.stringify(metric),
        headers: { Authorization: `Bearer ${config.metrics.apiKey}`, 'Content-Type': 'application/json' },
    })
        .then((response) => {
            if (!response.ok) {
                console.error(`Failed to push metrics ${metricName} data to Grafana`);
            } else {
                console.log(`Pushed ${metricName}`);
            }
        })
        .catch((error) => {
            console.error('Error pushing metrics:', error);
        });
}

module.exports = {
    requestTracker,
    incrementActiveUsers,
    decrementActiveUsers,
    trackAuthFailure,
    trackAuthSuccess,
    trackPizzaSold,
    trackPizzaCreationFailure,
    trackPizzaRevenue,
    trackPizzaCreationLatency
};