# 0008. Compute backend: WASM first, WebGPU later

- **Status:** Accepted
- **Date:** 2026-09-12

## Context

The brief says: assume WebGPU where available and a WASM/CPU fallback where it isn't; verify
iOS support; design the fallback path first.

Verified on 2026-09-12:

- WebGPU ships on by default in Safari 26 on macOS, iOS, iPadOS and visionOS. iPhones on
  older iOS versions don't have it.
- Nothing in the v1 pipeline *requires* a GPU. OpenCV.js runs on the CPU in WASM, and the
  per-frame work at 1080p analysis resolution is small.
- The WebGPU candidates are per-pixel steps: downscale + grayscale, `absdiff` / threshold /
  morphology (step 2), and compositing the trace at 4K during export. Phase 2's CNN would
  need WebGPU outright.

## Options considered

1. **WebGPU primary with a WASM fallback from day one.** Two implementations of the
   per-pixel steps to write, test and keep in sync, before we know either is too slow.
2. **WASM only in v1; WebGPU later as an accelerator** behind the same `CvBackend`
   interface, introduced when measurements justify it.
3. **WebGL2 fragment-shader "compute".** Wider support than WebGPU, but awkward for this
   work, and the platforms without WebGPU are shrinking.

## Decision

Option 2. In v1 the WASM/CPU path is the only path, so it is by construction the
best-tested one. A WebGPU implementation of selected steps may be added when:

1. device measurements (M0 spike, M5 on-device checks) show analysis or export missing the
   targets in ARCHITECTURE §8, **and**
2. the GPU implementation passes a parity test in the fixture harness: identical candidate
   sets within ±1 px and identical trajectory results on every fixture.

Capability detection picks the backend at runtime. The WASM path stays the reference
implementation.

## Consequences

- One code path to get right in v1; no "works on my Chrome, broken on iOS 18" split.
- Capable devices are slower than they could be until the accelerator exists.
- Cross-origin isolation (COOP/COEP) is not needed in v1 — no threads, no
  `SharedArrayBuffer` — which keeps hosting simple. It becomes relevant with a custom
  threaded OpenCV.js build ([ADR 0003](0003-cv-library-opencv-js.md)).
