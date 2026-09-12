# Decisions log

Smaller calls made along the way, newest first. Anything expensive to reverse gets an
[ADR](adr/) instead. Each entry says whether the project owner was asked.

## 2026-09-12 — planning session

### Confirmed with the project owner

- **Trajectory model is parametric `x(t)`, `y(t)`**, not `y = f(x)`, so down-the-line
  footage works. → [ADR 0006](adr/0006-trajectory-model-parametric.md)
- **Stock OpenCV.js 4.12 + TypeScript gap-fill** for `estimateAffinePartial2D` and the
  Kalman filter, which no prebuilt OpenCV.js exports; custom build later.
  → [ADR 0003](adr/0003-cv-library-opencv-js.md)
- **No ffmpeg.wasm fallback**; unsupported browsers get a clear message.
  → [ADR 0002](adr/0002-video-io-webcodecs-mediabunny.md)
- **Repository name `shot-tracer`**, public, MIT.

### Resolved without asking

**Planning**

- **M0 walking skeleton inserted before blob detection; deploy moved from last to M0.**
  The iOS decode/encode/memory assumption is the riskiest in the plan, and iPhone testing
  needs HTTPS. See [ROADMAP](ROADMAP.md#changes-from-the-briefs-proposed-order-and-why).
- **Editor (M6) before Kalman refinement (M7)** — manual correction delivers more value
  than incremental accuracy when ~50 % of handheld clips fail.
- **GitHub issues created for M0 *and* M1.** The brief asked for the first milestone only,
  but M1 (the brief's intended first milestone, now including the harness) is independent
  of M0 and can proceed in parallel.
- **`CLAUDE.md` added** so that implementation sessions pick up the conventions without
  re-reading every doc.

**Stack** (the brief delegated these; each has an ADR)

- **WebGPU deferred; WASM/CPU is the only v1 compute path.** → [ADR 0008](adr/0008-compute-backend-wasm-first.md)
- **UI: Preact + Signals.** → [ADR 0004](adr/0004-ui-framework-preact.md)
- **TypeScript 7, Vite 8, Biome 2, Vitest 5, Node 24** running tool scripts directly.
  → [ADR 0007](adr/0007-language-build-tooling.md)
- **Hosting: Cloudflare Workers static assets**, not Pages (Cloudflare's 2026
  recommendation for new projects). → [ADR 0010](adr/0010-hosting-cloudflare.md)
- **Eval harness in Node with ffmpeg decode.** → [ADR 0009](adr/0009-evaluation-harness-in-node.md)
- **Minimum engine Safari 16.4.** The video-only WebCodecs is enough because audio is copied,
  not decoded.

**Pipeline details** (small, in-spirit additions to the settled algorithm)

- **Analysis resolution defaults to 1080 lines.** All pixel-valued parameters from the
  brief (area 2–60 px, ±15 px window, inlier τ) are interpreted at analysis resolution.
- **Detect in frame coordinates, store in reference coordinates.** Frame *n−1* is warped
  into frame *n* for the difference; candidates are mapped to `R` via `A_n`. This avoids
  warping every frame into a drifting reference.
- **LK forward-backward check** in stabilization; **RTS smoother** after the Kalman filter;
  **circularity skipped for blobs under ~6 px²** (it is meaningless there); **per-frame
  candidate cap of ~200**; **contrast polarity switch** (`brighter` / `either`), because a
  ball against a bright overcast sky reads darker than its surroundings.
- **Seeded PRNG in RANSAC**, so evaluation runs are reproducible.
- **Output: H.264 MP4 at source resolution and fps**, display-oriented, audio copied, with
  a 1080p fallback when the encoder rejects 4K.
- **Undo/redo via immutable snapshots**, 200 steps.
- **Manual mode still runs stabilization** (skippable for tripod), otherwise the line would
  float.

**Fixtures and metrics**

- **Fixture videos are never committed**; `truth.json` is, with the video's SHA-256.
  Synthetic fixtures are regenerated, not committed.
- **Coordinates** are display-oriented source pixels, origin at the top-left corner (pixel
  centres at +0.5), frames 0-based in presentation order.
- **Errors are normalized to px@1080.** A clip passes at recall ≥ 0.8, median ≤ 4 px,
  |launch Δ| ≤ 3 frames and no false frames. The thresholds live in code and are versioned.
- **Labelling uses a dev-only page in this repo** rather than an external tool (e.g.
  CVAT): it reuses the browser decode path and writes our format directly.
- **`eval/baseline.json` is committed**; algorithm PRs update it deliberately.

**Housekeeping**

- **The iOS Photos picker's 720p re-encode can't be avoided in code**, so the app detects
  it and tells the user to pick from Files.
- **LICENSE copyright holder is `spekulazarus`** (the git user name). Change it if you
  prefer your legal name.
- **Dependabot** is monthly, with dev tooling grouped.

### Open, to be decided with data

- **HDR input handling** (tone-map vs. HEVC Main10 output) — after the M0 spike.
- **Custom OpenCV.js build** — after the M0/M5 device measurements.
- **Cubic vs. quadratic refit in step 4** — by the harness in M4.
