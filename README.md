# shot-tracer

**A broadcast-style golf ball tracer that runs entirely in your browser.**

Pick a clip of a golf shot you already recorded. shot-tracer finds the ball, fits its
flight path, and gives you the video back with a curved tracer line that grows along the
ball's flight frame by frame — the Toptracer TV look, made in post from ordinary phone
footage.

Nothing is uploaded. Decoding, tracking, and encoding all happen on your device.

> **Status: planning & scaffold.** There is no tracing yet. The design is in
> [ARCHITECTURE.md](ARCHITECTURE.md), the plan in [docs/ROADMAP.md](docs/ROADMAP.md).

## Why everything runs client-side

- **Upload is the slow part.** Source clips are 150–300 MB (4K60). Pushing them to a
  server takes longer than processing them locally.
- **No server means none of the server problems.** No egress, no object storage, no
  accounts, no queue, no abuse of a free tier, no bill, no GDPR exposure.
- **It deploys as static files** on Cloudflare or GitHub Pages — free to host, forever.
- **Your videos never leave your device.** Every other app in this space uploads your
  footage. This one can't: there is nowhere to upload to.

The full reasoning is in [ADR 0001](docs/adr/0001-client-side-only.md).

## How it works

Classical computer vision — no machine learning in v1:

1. **Stabilize** the camera (feature tracking + a similarity transform per frame).
2. **Extract motion** (difference of consecutive stabilized frames).
3. **Filter candidates** — small, round, bright blobs. Dozens of false positives per
   frame are expected.
4. **Fit the trajectory with RANSAC** over all candidates from all frames. Noise does not
   arrange itself into a smooth curve in time order; the ball does. This step is where
   the robustness comes from.
5. **Refine** with a Kalman filter and a second, tighter search.
6. **Extrapolate** once the ball is too small to see; optionally you tap where it landed.
7. **Render** the growing line, mapped back through the stabilization, and re-encode.

When detection fails you fix it by hand: move points, reshape the arc, or skip
detection entirely — tap impact and landing and the app draws the curve.

## What accuracy to expect

These are design targets, not measurements yet. Real numbers will come from the fixture
harness ([docs/TESTING.md](docs/TESTING.md)) as soon as the pipeline exists.

| Footage | Expected |
| --- | --- |
| Tripod, ball against open sky, 60 fps | should succeed nearly every time |
| Handheld, ball against a treeline | roughly half the time |
| Any footage, after ~20–40 frames of flight | the ball is sub-pixel; the rest of the line is extrapolated, and it gets much better if you tap the landing spot |

Commercial apps land in the same place, which is why they all ship manual correction.
So does this one — manual correction is a first-class feature, not a fallback.

## Browser support

| Browser | Status |
| --- | --- |
| Chrome / Edge (desktop) | Primary development target. iPhone HEVC clips need OS hardware decode (fine on Mac and Windows, often missing on Linux). |
| Safari on iOS / iPadOS / macOS | Supported from 16.4 (WebCodecs video); iOS 26+ recommended. |
| Firefox (desktop) | Best effort, H.264 clips. |
| Firefox for Android | Not supported (no WebCodecs). |

**On iPhone, pick your clip from Files, not Photos.** When a web page opens the Photos
picker, iOS re-encodes the video to 720p H.264 before the page sees it. Save the clip to
Files first (Share → Save to Files) to keep the full 4K original.

## Run it locally

Requires Node 24+.

```sh
npm install
npm run dev          # http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` / `preview` | Production build to `dist/` / serve it |
| `npm test` | Unit tests (Vitest) |
| `npm run eval` | Fixture harness: runs the tracker over `fixtures/` and prints a comparison table |
| `npm run lint` / `fix` | Biome lint + format check / auto-fix |
| `npm run typecheck` | TypeScript, app and tooling |
| `npm run check` | Everything CI runs |

**Testing on a phone:** WebCodecs only works in a secure context. Plain
`http://192.168.x.x:5173` from your phone is *not* one. Either use a preview deployment
(set up in milestone M0) or tunnel the dev server over HTTPS:

```sh
npm run dev
cloudflared tunnel --url http://localhost:5173   # prints an https://….trycloudflare.com URL
```

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — pipeline, data flow, module boundaries, fallback strategy
- [docs/adr/](docs/adr/) — architecture decision records
- [docs/ROADMAP.md](docs/ROADMAP.md) — milestones
- [docs/TESTING.md](docs/TESTING.md) — fixtures, metrics, evaluation harness
- [docs/DECISIONS-LOG.md](docs/DECISIONS-LOG.md) — smaller calls made along the way
- [fixtures/README.md](fixtures/README.md) — how to add your own footage

## Non-goals for v1

No accounts or payments, no machine learning, no live/real-time tracing, no swing
analysis or club tracking, no 3D maps or scorecards, and no server-side anything.

## License

[MIT](LICENSE).
