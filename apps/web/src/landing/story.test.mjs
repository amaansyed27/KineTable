import { test } from "node:test";
import assert from "node:assert/strict";
import { storyFrame, copyOpacity, chapterPositions } from "./story.mjs";
test("choreography is bounded, continuous, and reversible through assembly and release", () => {
  assert.deepEqual(storyFrame(-1), storyFrame(0));
  assert.deepEqual(storyFrame(2), storyFrame(1));
  let previous = storyFrame(0);
  const forward = [];
  for (let i = 0; i <= 1000; i++) {
    const frame = storyFrame(i / 1000);
    for (const key of Object.keys(frame)) {
      assert.ok(frame[key] >= 0 && frame[key] <= 1);
      assert.ok(Math.abs(frame[key] - previous[key]) < 0.04, `${key} jumps`);
    }
    forward.push(frame);
    previous = frame;
  }
  for (let i = 1000; i >= 0; i--)
    assert.deepEqual(storyFrame(i / 1000), forward[i]);
  chapterPositions.forEach((p, i) => assert.equal(copyOpacity(p, i), 1));
  assert.equal(storyFrame(0.82).table, 0);
  assert.equal(storyFrame(1).table, 1);
  assert.equal(storyFrame(0.25 * 0.82).sensor, 0);
  assert.equal(storyFrame(0.5 * 0.82).sensor, 1);
  assert.equal(storyFrame(0.8 * 0.82).signal, 0);
  assert.equal(storyFrame(0.95 * 0.82).signal, 1);
});
