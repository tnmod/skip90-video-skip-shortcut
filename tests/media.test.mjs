import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const scripts = await Promise.all(['config.js', 'media.js'].map((name) => readFile(new URL(`../${name}`, import.meta.url), 'utf8')));
const { getForwardTarget } = vm.runInNewContext(`${scripts.join('\n')}\nSkip90Media;`);

const cases = [
  ['normal forward seek', 200, 360, [[0, 360]], 90, 290],
  ['duration caps a partial seek', 320, 360, [[0, 380]], 90, 360],
  ['seekable end caps a partial seek', 200, 360, [[0, 240]], 90, 240],
  ['target in a gap uses the preceding range', 40, 360, [[0, 70], [150, 360]], 90, 70],
  ['target in a later range is reachable', 40, 360, [[0, 70], [100, 360]], 90, 130],
  ['target before the next range cannot overshoot', 70, 360, [[0, 70], [180, 360]], 90, null],
  ['expired live position can jump into its DVR range', 100, Infinity, [[120, 220]], 90, 190],
  ['infinite live duration is capped by its DVR range', 180, Infinity, [[120, 220]], 90, 220],
  ['no remaining forward time at the end', 360, 360, [[0, 360]], 90, null],
  ['no seekable ranges', 20, 360, [], 90, null],
];

for (const [description, currentTime, duration, ranges, skipSeconds, expected] of cases) {
  test(description, () => assert.equal(getForwardTarget(currentTime, duration, ranges, skipSeconds), expected));
}
