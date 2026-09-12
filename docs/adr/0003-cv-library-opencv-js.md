# 0003. CV library: stock OpenCV.js 4.12 + TypeScript gap-fill

- **Status:** Accepted (confirmed by the project owner)
- **Date:** 2026-09-12

## Context

The pipeline (ARCHITECTURE §5) needs `goodFeaturesToTrack`, `calcOpticalFlowPyrLK`,
`estimateAffinePartial2D`, `warpAffine`, `absdiff`, `threshold`, `morphologyEx`,
`findContours`, `contourArea`, `arcLength`, plus a Kalman filter. It must run in a browser
worker, on iOS Safari, and in Node (for the evaluation harness).

We installed the prebuilt npm packages and checked what they export (Node 24,
2026-09-12):

| Package | Size | `goodFeaturesToTrack` | `calcOpticalFlowPyrLK` | `estimateAffinePartial2D` | `KalmanFilter` | Threads / SIMD |
| --- | --- | --- | --- | --- | --- | --- |
| `@techstark/opencv-js@4.12.0-release.1` | 10.8 MB | ✓ | ✓ | **✗** | **✗** | no / no |
| `@techstark/opencv-js@5.0.0-release.1` | 13.3 MB | **✗** | ✓ | **✗** | **✗** | no / no |

Everything else on the list is present in both. The packages are single-file JS with
base64-embedded WASM, initializing in ~250 ms on desktop Node. The upstream
`opencv_js.config.py` whitelist simply does not include the missing functions.

## Options considered

1. **Stock 4.12 + TypeScript gap-fill.** Write the 4-DOF similarity estimator (RANSAC with a
   2-point minimal sample, least-squares refit) and the constant-acceleration Kalman
   filter/RTS smoother ourselves. Both are small (~150 lines together), deterministic and
   easy to unit-test.
2. **Custom OpenCV.js build from day one.** Emscripten in Docker, in CI, whitelisting exactly
   our functions, with SIMD. Smaller and faster, faithful to the brief's function list, but
   it puts build infrastructure in front of the first line of CV code.
3. **Pure TypeScript, no OpenCV.** Shi-Tomasi, pyramidal LK, contour tracing, morphology.
   Smallest bundle and full control, but slow to build and easy to get subtly wrong.
4. **Stock 5.0.** Newer, but it is missing even more and it is bigger.

## Decision

Option 1:

- Pin `@techstark/opencv-js` at exactly `4.12.0-release.1` (no caret range; binary
  behaviour changes between builds).
- `core/` reaches OpenCV only through a typed `CvBackend` interface in `src/cv/`, which also
  owns `Mat` lifetimes. Mats must be `delete()`d — every OpenCV call goes through a scoped
  helper, never raw.
- The similarity estimator and Kalman/RTS live in `src/geometry/`. The estimator matches
  `cv.estimateAffinePartial2D` semantics (RANSAC, reprojection threshold, confidence,
  refit on inliers).
- A **custom slim SIMD build** (option 2) is on the roadmap as a performance issue. It gets
  scheduled when M0/M5 measurements on iPhone show that load time, memory or throughput need
  it. The `CvBackend` interface means swapping the build touches only `src/cv/`.

## Consequences

- Unblocks milestone M1/M2 today, in Node and in the browser, with the same package, so
  harness results carry over.
- 10.8 MB of CV runtime on first use (lazy-loaded in the worker, then precached). On slow
  mobile networks this is the biggest part of the first load.
- No SIMD and no threads means slower per-frame processing than a tuned build. The budget
  in ARCHITECTURE §8 assumes this and M0 measures it.
- We maintain ~150 lines of numerical code that OpenCV would otherwise provide. Unit tests
  compare our similarity estimator against `cv.estimateAffine2D` on noise-free data, and
  against known synthetic transforms with outliers.
- If a future build needs a function the stock package lacks, the answer is option 2, not
  more hand-written CV.
