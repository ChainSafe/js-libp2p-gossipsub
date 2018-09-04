'use strict';

var _LatencyMonitor = require('./LatencyMonitor');

var _LatencyMonitor2 = _interopRequireDefault(_LatencyMonitor);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* Load me and I print things - e.g.
 * @example
 * $.getScript('http://path/to/file.js');
 * // In console you will see something like this:
 * // Event Loop Latency Monitor Loaded:
 * // {dataEmitIntervalMs: 5000, latencyCheckIntervalMs: 500}
 * // Event Loop Latency:
 * // {avgMs: 0, events: 10, maxMs: 0, minMs: 0}
 */
var monitor = new _LatencyMonitor2.default(); /* eslint-disable no-console */

console.log('Event Loop Latency Monitor Loaded: %O', {
  latencyCheckIntervalMs: monitor.latencyCheckIntervalMs,
  dataEmitIntervalMs: monitor.dataEmitIntervalMs
});
monitor.on('data', function (summary) {
  return console.log('Event Loop Latency: %O', summary);
});
//# sourceMappingURL=EventLoopPrinter.js.map
