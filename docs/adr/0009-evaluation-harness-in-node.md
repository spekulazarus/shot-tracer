# 0009. Evaluation harness runs in Node

- **Status:** Accepted
- **Date:** 2026-09-12

## Context

The project owner's top testing requirement: tell whether a change made tracking better or
worse, via one command that runs the pipeline over all fixtures and prints a comparison
table ([docs/TESTING.md](../TESTING.md)). It has to be fast enough to run after every
tweak, scriptable, and runnable in CI (at least on synthetic fixtures).

The browser pipeline decodes with WebCodecs, which Node doesn't have.

## Options considered

1. **Node + ffmpeg decode + the same `core/` code.** An ffmpeg subprocess writes grayscale
   frames at analysis resolution to a pipe. `core/` is DOM-free, and OpenCV.js runs
   unchanged in Node. Fast, simple, headless.
2. **Playwright driving a real browser** running the full `io/` stack. Most faithful
   decode path, but slower, more moving parts, and headless WebKit on Linux is not iOS
   Safari anyway.
3. **Both**, with (1) as the primary harness and (2) as a small parity job.

## Decision

Option 1 now; option 3 later. The `FrameSource` interface (ARCHITECTURE §7) has a
Node implementation backed by the system `ffmpeg`. The harness imports `core/` directly.
A Playwright parity job on two or three clips can come later, to catch
browser-vs-Node drift.

## Consequences

- Contributors need `ffmpeg` on `PATH` for real fixtures. CI installs it (or uses
  `ffmpeg-static`) for synthetic fixtures.
- ffmpeg and WebCodecs can differ slightly in colour-range handling and scaling filters.
  The Node frame source must match the browser downscale path as closely as practical, and
  metric thresholds tolerate ±0.5 px.
- `core/` and `geometry/` must stay free of DOM and Web APIs. This is enforced by a
  tsconfig without DOM libs for those directories.
- On-device performance and memory are *not* measured by the harness. That is the job of
  the on-device checklist.
