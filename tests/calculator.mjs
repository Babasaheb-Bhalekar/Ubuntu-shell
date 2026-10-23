import assert from 'node:assert/strict';
import {calculate} from '../target/calculator.js';

assert.equal(calculate('1 + 2 * 3'), 7);
assert.equal(calculate('-(4 + 2) / 3'), -2);
assert.equal(calculate('7 % 4'), 3);
assert.equal(calculate('1 / 0'), null);
assert.equal(calculate('2 + foo'), null);
assert.equal(calculate('2(3)'), null);
