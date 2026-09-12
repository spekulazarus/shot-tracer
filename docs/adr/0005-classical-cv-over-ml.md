# 0005. Classical CV over machine learning for v1

- **Status:** Accepted (settled in the project brief)
- **Date:** 2026-09-12

## Context

Finding a 2–60 px ball among birds, leaves, hands, and compression artefacts is the kind of
problem learned detectors (e.g. TrackNet-style heatmap CNNs) are good at. But:

- no public labelled golf-ball-in-flight dataset exists, so we would have to create one
  before training anything;
- running a CNN per frame on 4K60 clips in a browser needs WebGPU for acceptable speed,
  and WebGPU is on by default only from iOS 26;
- a model adds tens of MB to the first load, training infrastructure, and failure modes
  that are hard to debug.

Meanwhile, the flight of a ball is a smooth curve in time — a very strong prior that
classical robust fitting exploits directly. Commercial apps built on similar pipelines
report roughly: tripod against sky almost always, handheld against trees about half the
time, and they all ship manual correction.

## Options considered

1. **Classical pipeline** (stabilize → frame difference → blob filter → RANSAC trajectory →
   Kalman): deterministic, debuggable, no data needed, runs on CPU.
2. **Learned detector** replacing steps 2–3, keeping RANSAC/Kalman: potentially much better
   on hard backgrounds; blocked on data and WebGPU.
3. **End-to-end learned tracking:** blocked on data; discards the strong physical prior.

## Decision

Option 1 for v1. No ML model ships in v1.

## Consequences

- Accuracy has a ceiling on hard footage (handheld, treelines, overcast sky). The editor and
  manual mode carry those cases; this is why they are first-class.
- Everything is reproducible: the same clip and code give the same output, which makes the
  fixture harness meaningful.
- The design keeps the door open for option 2 in Phase 2. Candidate detection (steps 2–3)
  sits behind an interface that a heatmap model can implement. RANSAC and Kalman stay
  unchanged, since they are useful on top of any detector.
- The fixture labels and labelling tool (M1) are the start of the dataset Phase 2 needs.
  Labels are stored in source-resolution coordinates, with metadata, so they can be reused
  for training.
