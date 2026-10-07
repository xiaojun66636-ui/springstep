# springstep

Analytic spring integrator for interface motion. No runtime dependencies.

Forward Euler blows up when a frame takes 100ms. `springStep` evaluates the closed form of

```text
m x'' + c x' + k x = 0
```

where `x` is the offset from the target. Underdamped, critical, and overdamped branches are all exact for the `dt` you pass in.

## Use

```ts
import { springStep, settleTime } from "./src/spring.ts";

const config = { stiffness: 180, damping: 18, mass: 1 };

let state = { value: 0, velocity: 0 };
state = springStep(state, 100, 1 / 60, config);

const seconds = settleTime({ value: 0, velocity: 0 }, 100, config);
```

`settled` is true once both offset and velocity are inside `precision` (default `0.001`). At that point the state is snapped to the target so leftover energy does not drift.

## Design

- `stiffness` and `mass` must be `> 0`. `damping` must be `>= 0`.
- `zeta = c / (2 * sqrt(k m))` picks the branch. `zeta < 1` overshoots, `zeta = 1` is the fastest approach that does not reverse, `zeta > 1` crawls in from one side.
- `settleTime` binary-searches the analytic step. It does not simulate a frame loop.
- A clock is not built in. You own `dt`, which is what you want when the display refresh is not the simulation clock.

## Test

Node 22 or newer. Nothing to install.

```bash
node --experimental-strip-types --test test/*.test.ts
```

## License

MIT
