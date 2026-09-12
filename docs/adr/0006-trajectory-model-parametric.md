# 0006. Trajectory model: parametric x(t), y(t)

- **Status:** Accepted (confirmed by the project owner)
- **Date:** 2026-09-12

## Context

The brief's step 4 samples 3 candidates from distinct frames, fits `y = ax² + bx + c`, and
scores inliers that lie near the curve, appear in increasing frame order, and keep roughly
constant horizontal velocity.

That model describes a **face-on** view (camera perpendicular to the target line): gravity
is vertical, horizontal speed is nearly constant, and the image path is a parabola in *x*.

Most phone footage, and all of the broadcast-tracer look, is shot **down-the-line** (from
behind the golfer). There the ball recedes from the camera: in the image it climbs nearly
vertically, drifts a little left or right, slows due to perspective, and after the apex may
come back down while *x* barely changes. `y = f(x)` is ill-conditioned for a near-vertical
path, fails outright when the path doubles back in *y*, and "constant horizontal velocity"
does not hold under perspective.

## Options considered

1. **`y = f(x)` as briefed.** Simple; works face-on. Down-the-line clips would mostly fail
   into manual mode.
2. **Parametric in time:** `x(t) = aₓt² + bₓt + cₓ`, `y(t) = a_yt² + b_yt + c_y`, with *t* the
   frame time. Still fitted exactly from 3 timed samples, so RANSAC is unchanged.
3. **Both, switchable,** and let the harness decide. More code and more tuning surface in
   the milestone that matters most.
4. **A 3D ballistic model** with camera calibration. Physically right, but it needs camera
   intrinsics and pose we don't have. Out of scope.

## Decision

Option 2. The RANSAC hypothesis is a pair of quadratics in time. A candidate is an inlier
when it lies within τ of the model's prediction **at the candidate's own frame**. At most
one inlier counts per frame; the score is the longest temporally coherent run of inlier
frames. After the final least-squares refit, a cubic-in-*t* variant may be selected when the
fixture harness shows it helps on long down-the-line flights.

*t* is computed from presentation timestamps (`t = timestamp · fps`) rather than raw frame
index, so variable-frame-rate clips don't bend the model.

## Consequences

- Works for both views. For face-on footage it reduces to the brief's model: with `aₓ ≈ 0`,
  eliminating *t* gives `y = ax² + bx + c`.
- The brief's temporal constraints stop being separate checks. Frame order holds by
  construction, and velocity smoothness is built into the model.
- The inlier test is stricter than a purely spatial one. Noise must be at the right place
  *and* the right time, which reduces accidental inliers from static clutter lined up along
  a curve.
- The model predicts a position for every frame, so the Kalman stage (step 5) initializes
  from it directly and gap-filling is trivial.
- A quadratic in *t* is only locally valid under strong perspective. Beyond ~0.5 s the
  cubic option, the Kalman pass, and the editor absorb the rest. This is risk #7 in
  ARCHITECTURE §12.
