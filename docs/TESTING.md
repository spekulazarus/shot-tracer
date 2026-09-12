# Testing strategy

The question this has to answer on every change is **did tracking get better or worse?**
Unit tests matter less than that. So the centre of the strategy is a fixture harness:
real clips, hand-labelled ball positions, one command that prints a comparison table.

| Layer | Tool | Answers |
| --- | --- | --- |
| **Fixture harness** | `npm run eval` (Node) | Is the tracker better or worse than the baseline, per clip and overall? |
| Synthetic fixtures | generator + harness, in CI | Did something break outright? Is stabilization correct against a known camera path? |
| Unit tests | Vitest | Do the maths pieces (similarity RANSAC, polynomial fit, Kalman, spline, inverse transforms, undo/redo) do what they claim? |
| On-device checks | manual checklist | Does it actually work on an iPhone (memory, decode, export, share)? |

## Fixture format

One directory per clip. The video is gitignored; the labels are committed.

```
fixtures/real/dtl-tripod-sky-01/
  clip.mov      # trimmed original, never committed
  truth.json    # labels, validated against fixtures/truth.schema.json
```

`truth.json` (abridged, see [fixtures/example/truth.json](../fixtures/example/truth.json)):

```json
{
  "$schema": "../../truth.schema.json",
  "schemaVersion": 1,
  "clip":   { "file": "clip.mov", "sha256": "…", "width": 3840, "height": 2160, "fps": 59.94, "frameCount": 301 },
  "meta":   { "view": "down-the-line", "mount": "tripod", "background": "sky" },
  "events": { "impactFrame": 62, "lostFrame": 101, "landing": { "frame": null, "x": 2034.0, "y": 1180.5 } },
  "points": [ { "frame": 62, "x": 1921.5, "y": 1804.0, "visibility": "visible" } ]
}
```

### Conventions

- **Coordinates** are display-oriented source pixels: the container's rotation is
  applied, and the origin is the top-left corner of the image, so the centre of the top-left
  pixel is (0.5, 0.5). Always at full source resolution, never analysis resolution.
- **Frames** are 0-based indices in presentation order of the decoded video.
- **`impactFrame`** is the first frame on which the ball has left its resting position.
  **`lostFrame`** is the last frame on which a human can still find it (or `null`).
- **`points`**: label *every* frame from `impactFrame` to `lostFrame`. Use `uncertain` for
  best guesses; they are excluded from error metrics. A missing frame in that range means
  "not labelled", not "ball absent".
- **`landing`** is optional: where the ball came down, in the coordinates of `landing.frame`
  (or of the last frame when that is `null`).
- **`meta`** (view × mount × background) drives the per-category breakdown in the report.
- **`sha256`** ties labels to one exact encode; the harness warns when it doesn't match.

### Labelling protocol

Use the labelling tool (milestone M1): a dev-only page that decodes the clip in the browser
and shows one frame at a time at up to 4× zoom.

1. Scrub to impact and mark `impactFrame`.
2. Tap the ball centre on each frame; the tool advances automatically (→ next, ← back,
   `u` toggles uncertain).
3. Mark `lostFrame` when you can no longer find the ball, and the landing point if it is
   visible or known.
4. Export `truth.json`; the tool fills in dimensions, fps, frame count and SHA-256.

Expect 3–5 minutes per clip. Ten well-chosen clips are worth more than fifty similar ones;
aim to cover every view × mount × background combination.

## Metrics

Errors are normalized to a 1080-line frame so that clips of different resolutions are
comparable:

```
e(frame) = ‖predicted − truth‖ · 1080 / clip.height        [px@1080]
```

Let **L** be the set of `visible` labelled frames. Each predicted point carries a provenance
(`detected | refined | interpolated | extrapolated | manual`). Everything except
`extrapolated` is scored against L; `extrapolated` is scored only against `landing`.

| Metric | Definition | Why |
| --- | --- | --- |
| **recall** | fraction of L with a prediction within τ = 10 px@1080 | Did we follow the ball at all? |
| **median err** | median of `e` over frames in L that have a prediction | Accuracy, robust to a few misses |
| **p90 err** | 90th percentile of the same | Catches a track that drifts off late |
| **mean err** | mean of the same | Reported because the brief asks for it; decisions use the median |
| **launch Δ** | first predicted frame − `impactFrame` | Late starts look wrong on screen |
| **false frames** | predicted non-extrapolated frames before `impactFrame − 2` or after `lostFrame + 2` | A tracer on a bird |
| **landing err** | `e` at the landing point, if labelled | Quality of step 6 |
| **cand recall** | fraction of L with *any* step-3 candidate within τ | Blames steps 2–3 vs. step 4 when a clip fails |

Stage diagnostics (synthetic fixtures only, where the camera path is known): **stab
residual**, the RMS error of `A_n` applied to a grid of points, in px@1080.

### Pass / fail per clip

A clip **passes** when all of these hold (defaults live in `tools/eval/config.ts` and are
versioned with the code):

- recall ≥ 0.80
- median err ≤ 4 px@1080
- |launch Δ| ≤ 3 frames
- false frames = 0

### Suite summary

- Pass rate overall, and per `mount × background` and per `view` — this is how the brief's
  accuracy claims ("nearly every time" on tripod/sky, "roughly half" handheld/treeline)
  become checkable.
- Mean recall and the median of per-clip median errors.
- Analysis time per frame (Node; indicative only — device speed is measured separately).

## The harness

```
npm run eval                        # every fixture whose clip is present
npm run eval -- --filter 'real/dtl-*'
npm run eval -- --baseline          # compare against eval/baseline.json, show deltas
npm run eval -- --save-baseline     # record the current results as the new baseline
npm run eval -- --json eval-out/report.json
npm run eval -- --debug-video       # write overlay videos for failing clips to eval-out/
npm run eval -- --set diffThreshold=20 --set circularityMin=0.5   # override PipelineConfig
npm run eval -- --strict            # exit 1 on any regression vs. baseline (used in CI)
```

Target output (M1 onwards):

```
fixture                    view  mount     bg        recall  med   p90   launch  cand   result  Δmed
real/dtl-tripod-sky-01     DTL   tripod    sky       0.95    1.8   3.9   0       0.97   PASS    -0.3
real/dtl-hand-trees-02     DTL   handheld  treeline  0.41    6.2   18.4  +3      0.66   FAIL    +1.1 ▲
real/fo-tripod-sky-01      FO    tripod    sky       1.00    1.1   2.0   0       1.00   PASS     0.0
synthetic/dtl-shake-03     DTL   handheld  sky       0.98    0.6   1.2   0       1.00   PASS    -0.1

pass 3/4 (75%) · tripod+sky 2/2 · handheld+treeline 0/1 · handheld+sky 1/1
median of medians 1.45 px@1080 · mean recall 0.84 · 9.8 ms/frame
regressions vs baseline: real/dtl-hand-trees-02 (median +1.1 px)
```

A **regression** is: a clip going PASS → FAIL, a median error up by more than 25 % *and*
0.5 px, or recall down by more than 0.05.

`eval/baseline.json` is committed. An algorithm PR that changes results updates the
baseline in the same PR, so the diff shows what moved. Clips missing on the machine
running the harness are listed but not scored.

**The pipeline is deterministic.** RANSAC uses a seeded PRNG, so the same code and the
same clip give the same numbers. Any run-to-run noise is a bug.

## Synthetic fixtures

`tools/synth` (M1) renders short clips with exactly known ground truth: a textured
sky/grass background, a sub-pixel-rendered ball that shrinks over time on face-on and
down-the-line style paths, distractors (drifting "birds", flicker, foliage-like noise),
optional random camera shake (a known similarity path, which gives the stabilization
ground truth), and H.264 compression at a realistic CRF. Generation is seeded and fast, so
the clips are regenerated rather than committed, and CI runs the harness on them with
`--strict`.

Synthetic fixtures catch breakage. They do not prove the tracker works on real
footage — only the real fixtures do.

## Unit tests

Colocated `*.test.ts` files, Vitest, Node environment. Required for everything in
`geometry/` and `editor/`, and for the step-7 invariant: *a point fixed in `R`, drawn
through `A_n⁻¹` on frame n and mapped back through `A_n`, returns to itself* — the
floating-trace bug gets a permanent test. Coverage percentages are not a goal.

## On-device checklist

Run before each milestone demo on at least one iPhone (and before releases on an older
one), with a 4K60 HDR clip picked from Files:

- [ ] Capability probe passes (decoder for the clip's codec, H.264 encoder at source resolution)
- [ ] Analysis completes; peak memory (Safari Web Inspector → Timelines) within budget
- [ ] Export completes; the output plays in Photos, colours look right, and audio is present
- [ ] The trace stays locked to the ball on a handheld clip (no floating)
- [ ] Share → Save Video works; the app works offline after a reload in airplane mode
