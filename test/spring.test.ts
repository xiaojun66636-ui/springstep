import assert from "node:assert/strict";
import { test } from "node:test";
import { settleTime, springStep } from "../src/spring.ts";

const rest = { value: 0, velocity: 0 };

test("dt 0 returns the same state", () => {
  const next = springStep({ value: 4, velocity: 2 }, 10, 0, {
    stiffness: 180,
    damping: 12,
  });
  assert.equal(next.value, 4);
  assert.equal(next.velocity, 2);
  assert.equal(next.settled, false);
});

test("a resting spring stays on the target", () => {
  const next = springStep({ value: 10, velocity: 0 }, 10, 0.5, {
    stiffness: 200,
    damping: 20,
  });
  assert.equal(next.settled, true);
  assert.equal(next.value, 10);
  assert.equal(next.velocity, 0);
});

test("underdamped motion crosses the target", () => {
  const config = { stiffness: 400, damping: 2, mass: 1 };
  let crossed = false;
  for (let i = 1; i <= 80; i++) {
    const step = springStep(rest, 100, i / 200, config);
    if (step.value > 100) crossed = true;
  }
  assert.equal(crossed, true);
  const late = springStep(rest, 100, 5, config, 0.01);
  assert.ok(Math.abs(late.value - 100) < 1);
});

test("overdamped motion does not cross the target", () => {
  const config = { stiffness: 40, damping: 80, mass: 1 };
  for (let i = 1; i <= 40; i++) {
    const step = springStep(rest, 100, i / 20, config);
    assert.ok(step.value >= 0 && step.value <= 100);
    if (!step.settled) assert.ok(step.velocity >= -1e-9);
  }
});

test("critical damping settles without a late reversal", () => {
  const config = { stiffness: 100, damping: 20, mass: 1 };
  let previous = 0;
  for (let i = 1; i <= 50; i++) {
    const step = springStep(rest, 50, i / 50, config);
    assert.ok(step.value + 1e-6 >= previous);
    assert.ok(step.value <= 50 + 1e-6);
    previous = step.value;
  }
});

test("settleTime is zero at rest and finite in motion", () => {
  const config = { stiffness: 220, damping: 24 };
  assert.equal(settleTime({ value: 1, velocity: 0 }, 1, config), 0);
  const time = settleTime(rest, 1, config, 0.001);
  assert.ok(time > 0 && time < 10);
  assert.equal(springStep(rest, 1, time, config, 0.001).settled, true);
});

test("rejects bad input", () => {
  assert.throws(() => springStep(rest, 1, -0.1, { stiffness: 1, damping: 1 }));
  assert.throws(() => springStep(rest, 1, 0.1, { stiffness: 0, damping: 1 }));
  assert.throws(() => springStep(rest, 1, 0.1, { stiffness: 1, damping: -1 }));
  assert.throws(() =>
    springStep(rest, 1, 0.1, { stiffness: 1, damping: 1, mass: 0 }),
  );
});
