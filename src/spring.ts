export type SpringConfig = {
  /** Stiffness k. Must be > 0. */
  stiffness: number;
  /** Damping c. Must be >= 0. */
  damping: number;
  /** Mass m. Must be > 0. Defaults to 1. */
  mass?: number;
};

export type SpringState = {
  value: number;
  velocity: number;
};

export type SpringStep = SpringState & {
  offset: number;
  settled: boolean;
};

const DEFAULT_PRECISION = 1e-3;

function assertConfig(config: SpringConfig): number {
  const mass = config.mass ?? 1;
  if (!(config.stiffness > 0) || !(config.damping >= 0) || !(mass > 0)) {
    throw new Error("stiffness and mass must be > 0 and damping must be >= 0");
  }
  if (
    !Number.isFinite(config.stiffness) ||
    !Number.isFinite(config.damping) ||
    !Number.isFinite(mass)
  ) {
    throw new Error("spring config must be finite");
  }
  return mass;
}

/**
 * Advance a damped harmonic spring toward `target` by `dt` seconds.
 * Uses the closed-form solution, so a dropped frame cannot explode the way
 * forward-Euler does.
 *
 * The equation is m x'' + c x' + k x = 0, where x is the offset from target.
 */
export function springStep(
  state: SpringState,
  target: number,
  dt: number,
  config: SpringConfig,
  precision = DEFAULT_PRECISION,
): SpringStep {
  if (!Number.isFinite(dt) || dt < 0) {
    throw new Error("dt must be a finite number >= 0");
  }
  if (
    !Number.isFinite(state.value) ||
    !Number.isFinite(state.velocity) ||
    !Number.isFinite(target) ||
    !(precision >= 0)
  ) {
    throw new Error("state, target, and precision must be finite");
  }

  const mass = assertConfig(config);
  const offset0 = state.value - target;
  if (dt === 0) {
    const settled =
      Math.abs(offset0) <= precision && Math.abs(state.velocity) <= precision;
    return settled
      ? { value: target, velocity: 0, offset: 0, settled: true }
      : { value: state.value, velocity: state.velocity, offset: offset0, settled: false };
  }

  const omega0 = Math.sqrt(config.stiffness / mass);
  const zeta = config.damping / (2 * Math.sqrt(config.stiffness * mass));
  const x0 = offset0;
  const v0 = state.velocity;

  let offset: number;
  let velocity: number;

  if (zeta < 1) {
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
    const decay = Math.exp(-zeta * omega0 * dt);
    const cos = Math.cos(omegaD * dt);
    const sin = Math.sin(omegaD * dt);
    const a = x0;
    const b = (v0 + zeta * omega0 * x0) / omegaD;
    offset = decay * (a * cos + b * sin);
    const damp = zeta * omega0;
    velocity =
      -damp * decay * (a * cos + b * sin) +
      decay * omegaD * (-a * sin + b * cos);
  } else if (zeta === 1) {
    const a = x0;
    const b = v0 + omega0 * x0;
    const decay = Math.exp(-omega0 * dt);
    offset = (a + b * dt) * decay;
    velocity = (b - omega0 * (a + b * dt)) * decay;
  } else {
    const root = omega0 * Math.sqrt(zeta * zeta - 1);
    const r1 = -zeta * omega0 + root;
    const r2 = -zeta * omega0 - root;
    const a = (v0 - r2 * x0) / (r1 - r2);
    const b = x0 - a;
    const e1 = Math.exp(r1 * dt);
    const e2 = Math.exp(r2 * dt);
    offset = a * e1 + b * e2;
    velocity = a * r1 * e1 + b * r2 * e2;
  }

  if (!Number.isFinite(offset) || !Number.isFinite(velocity)) {
    throw new Error("spring step produced a non-finite state");
  }

  if (Math.abs(offset) <= precision && Math.abs(velocity) <= precision) {
    return { value: target, velocity: 0, offset: 0, settled: true };
  }

  return { value: target + offset, velocity, offset, settled: false };
}

/** Seconds until the spring is within `precision` of the target. Caps at 60s. */
export function settleTime(
  state: SpringState,
  target: number,
  config: SpringConfig,
  precision = DEFAULT_PRECISION,
): number {
  const cap = 60;
  if (springStep(state, target, 0, config, precision).settled) return 0;

  let hi = 1 / 120;
  while (hi < cap && !springStep(state, target, hi, config, precision).settled) {
    hi *= 2;
  }
  if (!springStep(state, target, hi, config, precision).settled) return cap;

  let lo = 0;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    if (springStep(state, target, mid, config, precision).settled) hi = mid;
    else lo = mid;
  }
  return hi;
}
