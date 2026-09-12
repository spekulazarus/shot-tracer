# 0007. Language, build and tooling: TypeScript, Vite, Biome, Vitest

- **Status:** Accepted
- **Date:** 2026-09-12

## Context

Requirements: builds to a static bundle; runs on iOS Safari 16.4+; `npm run dev` gives a
working environment in one command; workers and WASM must bundle cleanly; the same pipeline
code must run in Node for the fixture harness; CI must be fast.

## Options considered

**Language.**
- *TypeScript* — the pipeline is full of coordinate spaces, matrices and message protocols
  where types catch real bugs.
- *JavaScript* — no benefit here.
- *Rust → WASM* for the core — fast per-pixel work, but OpenCV already covers the heavy
  pixel operations, and our own code (RANSAC, Kalman, splines) is cheap. It would add a
  second toolchain. It is an option later if profiling points at our own code.

**Build.** Vite (dev server, HMR, first-class workers and WASM assets, the PWA plugin
ecosystem) vs. esbuild or Rsbuild directly (more wiring) vs. Parcel (smaller ecosystem for
our needs).

**Lint/format.** Biome (one fast tool, one config) vs. ESLint + typescript-eslint +
Prettier (more rules, three tools and more config).

**Tests.** Vitest (shares Vite's config and transforms, fast) vs. Jest (needs a separate
TypeScript/ESM setup) vs. `node:test` (bare).

**Running TypeScript tools in Node.** Node 24 strips types natively vs. `tsx`/`ts-node`.

## Decision

- **TypeScript 7** (the native compiler), `strict`, plus `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes` and **`erasableSyntaxOnly`**. The last one means no enums,
  namespaces or parameter properties, so the same `.ts` files run directly in Node. Imports
  use explicit `.ts` extensions.
- **Vite 8** with `@preact/preset-vite`; build target `es2022` + `safari16.4`; ES-module
  workers.
- **Biome 2** for lint and format: two-space indent, single quotes, no semicolons, width 100.
- **Vitest 5**, Node environment, colocated `*.test.ts`.
- **Node 24** (`.nvmrc`) runs `tools/**/*.ts` directly (`npm run eval`), with no extra
  runner.
- **npm**, with a committed lockfile; `npm ci` in CI.
- Two tsconfigs: `tsconfig.json` for the app (DOM libs) and `tsconfig.node.json` for tools
  and config (Node types). When `src/core` and `src/geometry` appear they get their own
  config without DOM libs, so any DOM use there is a type error (ARCHITECTURE §7 rule 1).

## Consequences

- One command to start (`npm install && npm run dev`), one to verify (`npm run check`,
  which is exactly what CI runs).
- TypeScript 7 is the new native compiler and very fast, but young. If a tool in the chain
  can't handle it yet, pin TypeScript 6 — that is a devDependency change only.
- Biome has fewer lint rules than the ESLint ecosystem. Acceptable for a small codebase;
  revisit if we miss specific rules.
- Relying on Node's type stripping means Node ≥ 24 for contributors.
