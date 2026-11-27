import assert from 'node:assert/strict';
import { gradeMotion, motionPoints, motionPractical, motionSample } from '../practical-motion.js';

const speed = { pointA: 'A', pointB: 'E', gradient: '2.5', gradientUnit: 'm/s' };
const travel = { pointA: 'A', pointB: 'E', gradient: '0.5', gradientUnit: 'm/s²', distance: '16', distanceUnit: 'm' };

assert.deepEqual(motionPoints(6, true).map(({ time, value }) => [time, value]), [[0, 2], [1, 4.5], [2, 7], [3, 9.5], [4, 12]]);
assert.deepEqual(motionPoints(7, true).map(({ time, value }) => [time, value]), [[0, 0], [2, 1], [4, 2], [6, 3], [8, 4]]);
assert.deepEqual(motionSample(6, 0.5, false), { time: 2, distance: 4.5, speed: 1.75 });
assert.deepEqual(motionSample(7, 0.5, false), { time: 4, distance: 6, speed: 3, acceleration: 0.75 });

assert.equal(gradeMotion(6, true, speed).code, 'complete');
assert.equal(gradeMotion(6, true, { ...speed, pointA: 'D', pointB: 'B' }).code, 'complete');
assert.equal(gradeMotion(6, true, { ...speed, pointB: 'A' }).code, 'same-time');
assert.equal(gradeMotion(6, true, { ...speed, pointB: 'Z' }).code, 'points');
assert.equal(gradeMotion(6, true, { ...speed, gradient: '3' }).code, 'gradient-number');
assert.equal(gradeMotion(6, true, { ...speed, gradientUnit: 'm/s²' }).code, 'gradient-unit');
assert.equal(gradeMotion(6, true, { ...speed, gradient: '2.51' }).code, 'complete');
assert.equal(gradeMotion(6, true, { ...speed, gradient: '2.511' }).code, 'gradient-number');
assert.equal(gradeMotion(6, false, { ...speed, gradient: '1.75' }).code, 'complete');
assert.equal(gradeMotion(6, false, speed).code, 'gradient-number');
assert.deepEqual(gradeMotion(6, true, { ...speed, gradient: '  ' }), { code: 'incomplete' });

assert.equal(gradeMotion(7, true, travel).code, 'complete');
assert.equal(gradeMotion(7, true, { ...travel, pointA: 'B', pointB: 'D', distance: '8' }).code, 'complete');
assert.equal(gradeMotion(7, true, { ...travel, pointA: 'D', pointB: 'B', distance: '8' }).code, 'complete');
assert.equal(gradeMotion(7, true, { ...travel, pointB: 'A' }).code, 'same-time');
assert.equal(gradeMotion(7, true, { ...travel, gradient: '1' }).code, 'gradient-number');
assert.equal(gradeMotion(7, true, { ...travel, gradientUnit: 'm/s' }).code, 'gradient-unit');
assert.equal(gradeMotion(7, true, { ...travel, pointA: 'B', pointB: 'D' }).code, 'distance-number');
assert.equal(gradeMotion(7, true, { ...travel, distanceUnit: 'm/s' }).code, 'distance-unit');
assert.equal(gradeMotion(7, false, { ...travel, gradient: '0.75', distance: '24' }).code, 'complete');
assert.deepEqual(gradeMotion(7, true, { ...travel, distance: '' }), { code: 'incomplete' });
assert.deepEqual(gradeMotion(7, false, motionPractical.createState()), { code: 'points' });

console.log('Round 2 motion graph checks passed for selected intervals, units, rounding, and independent traces.');
