# Architecture Decision Records

One file per decision that is expensive to reverse. Each records the context, the options
that were considered, the decision, and its consequences. Smaller calls go in
[../DECISIONS-LOG.md](../DECISIONS-LOG.md).

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-client-side-only.md) | Everything runs client-side; no backend | Accepted |
| [0002](0002-video-io-webcodecs-mediabunny.md) | Video I/O: WebCodecs + Mediabunny, no ffmpeg.wasm | Accepted |
| [0003](0003-cv-library-opencv-js.md) | CV library: stock OpenCV.js 4.12 + TypeScript gap-fill | Accepted |
| [0004](0004-ui-framework-preact.md) | UI framework: Preact + Signals | Accepted |
| [0005](0005-classical-cv-over-ml.md) | Classical CV over machine learning for v1 | Accepted |
| [0006](0006-trajectory-model-parametric.md) | Trajectory model: parametric x(t), y(t) | Accepted |
| [0007](0007-language-build-tooling.md) | TypeScript, Vite, Biome, Vitest | Accepted |
| [0008](0008-compute-backend-wasm-first.md) | Compute backend: WASM first, WebGPU later | Accepted |
| [0009](0009-evaluation-harness-in-node.md) | Evaluation harness runs in Node | Accepted |
| [0010](0010-hosting-cloudflare.md) | Hosting: Cloudflare Workers static assets | Accepted |

## Writing a new ADR

Copy [template.md](template.md) to `NNNN-short-title.md` and add it to the table. ADRs
are never edited to reverse a decision. Write a new one that supersedes the old one, and
set the old one's status to `Superseded by NNNN`.
