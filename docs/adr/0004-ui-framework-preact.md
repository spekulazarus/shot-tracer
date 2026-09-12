# 0004. UI framework: Preact + Signals

- **Status:** Accepted
- **Date:** 2026-09-12

## Context

The UI is essentially one screen: pick a clip; watch analysis progress; scrub a
frame-accurate preview with the trace overlaid; tap and drag control points; undo/redo;
export and share. It must feel smooth on mobile Safari — dragging a handle or scrubbing
should update at display rate — while heavy work runs in workers.

The editing logic (document, operations, history) is framework-agnostic TypeScript in
`src/editor/` by design. The framework only renders and forwards input. The code will
largely be written in future sessions, partly AI-assisted, so conventional, widely known
patterns are worth something.

Bundle size is **not** a differentiator: the OpenCV.js runtime (10.8 MB) dwarfs any
framework.

## Options considered

1. **React 19.** Largest ecosystem, most familiar. Re-render model needs care (memo,
   refs) for 60 Hz drags and scrubbing. ~45 KB gzipped.
2. **Preact + `@preact/signals`.** React's API and JSX at ~4 KB. Signals update exactly the
   DOM or canvas that depends on a value, without re-rendering component trees — a good
   fit for scrubbing and dragging. Compatible with most React knowledge.
3. **Svelte 5.** Excellent performance, compiled, small. Runes-era syntax is newer, and a
   common source of Svelte 4/5 mix-ups in examples and generated code.
4. **SolidJS.** Fine-grained reactivity like signals, great performance, smaller
   ecosystem, and JSX semantics that differ subtly from React.
5. **Lit / vanilla TS.** No framework cost, but we would rebuild state-to-UI plumbing
   ourselves.

## Decision

Preact with `@preact/signals`, in TSX, via `@preact/preset-vite`.

- The editor store (`src/editor/`) is plain TypeScript. A thin adapter exposes its state as
  signals.
- Canvas drawing (preview, overlay, handles) happens in effects that read signals, not in
  component render functions.
- `preact/compat` is used only if a specific React library is needed.

## Consequences

- Familiar React-style code, with fine-grained updates where they matter.
- Some React ecosystem libraries need `preact/compat`. We expect to need few or none —
  the UI is custom canvas work plus a handful of controls.
- Because the editor logic is framework-free and unit-tested in Node, switching framework
  later would cost the `ui/` directory, not the product.
