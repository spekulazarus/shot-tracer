# shot-tracer — notes for coding sessions

Client-side golf shot tracer (static PWA, no backend). Read before changing code:
[ARCHITECTURE.md](ARCHITECTURE.md) (§4 coordinate systems is mandatory before touching
geometry or rendering), the relevant [ADR](docs/adr/), and the issue you are working on.

## Commands

```sh
npm run dev        # Vite dev server
npm run check      # lint + typecheck + test + build + eval — what CI runs
npm run eval       # fixture harness; run before and after any tracker change
npm run fix        # Biome auto-fix + format
```

## Rules

- `src/core/` and `src/geometry/` are pure TypeScript: no DOM, no Web APIs, no imports from
  `io/`, `ui/`, `render/`. They run in Node (harness) and in workers.
- Only `src/io/` touches WebCodecs, Mediabunny, OPFS or `navigator.share`.
- OpenCV is reached only through `src/cv/`. Every `Mat` is freed via the scoped helper.
- Persisted geometry is always in source display pixels (`S_n`) or reference space (`R`),
  never analysis pixels. Transforms: `A_n` maps `S_n → R`; render with `A_n⁻¹`.
- Close every `VideoFrame` as soon as you are done with it. Never buffer decoded frames.
- Tuning parameters live in `PipelineConfig`, never inline.
- **Tracker changes:** run `npm run eval -- --baseline` before and after, and paste the table
  into the PR. Update `eval/baseline.json` deliberately in the same PR.
- TypeScript is erasable-syntax only (no enums, namespaces or parameter properties);
  relative imports use `.ts` extensions.

## Working agreement

- Small commits at logical checkpoints with clear messages.
- Uncertain between two approaches → ask the owner. Resolved something without asking →
  add it to [docs/DECISIONS-LOG.md](docs/DECISIONS-LOG.md).
- If an assumption in the docs turns out wrong (browser support, library behaviour,
  performance), say so immediately instead of engineering around it.
