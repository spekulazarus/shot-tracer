# 0002. Video I/O: WebCodecs + Mediabunny, no ffmpeg.wasm

- **Status:** Accepted (ffmpeg.wasm decision confirmed by the project owner)
- **Date:** 2026-09-12

## Context

We need to:

- read `.mov`/`.mp4` from iPhones and Android phones (HEVC or H.264; iPhone default is
  10-bit HDR HEVC), frame-accurately and in presentation order, **several times** (analysis,
  refinement, export);
- write an MP4 with the traced video and the original audio;
- stay inside iOS Safari's memory limits, which kill a tab silently at reportedly
  ~100–200 MB on smaller devices.

WebCodecs does codecs only; containers need a demuxer and a muxer.

Verified on 2026-09-12:

- WebCodecs video (`VideoDecoder`, `VideoEncoder`, `VideoFrame`) is in Safari since 16.4;
  the full API (including audio) since Safari 26 on macOS/iOS/iPadOS. Chrome/Edge 94+,
  Firefox desktop 130+, Samsung Internet 17+. **Not** in Firefox for Android. Global
  coverage ≈ 94 %.
- HEVC decode through WebCodecs is effectively universal on Safari. In Chrome it depends
  on hardware and OS support (fine on macOS and Windows, often absent on Linux).
- ffmpeg.wasm keeps its input in WASM memory. Multithreading needs `SharedArrayBuffer`
  (cross-origin isolation). A 150–300 MB 4K clip is not viable on iOS, and elsewhere it is
  an order of magnitude slower than hardware WebCodecs.
- Mediabunny (MPL-2.0, TypeScript, zero dependencies) demuxes and muxes MP4/MOV/WebM/MKV
  on top of WebCodecs. It reads a `File` in slices through `BlobSource` with a bounded
  cache, and can copy encoded packets (audio passthrough) without decoding.

## Options considered

1. **WebCodecs + Mediabunny.** Hardware codecs, streaming demux and mux, one maintained
   library for both directions, audio passthrough.
2. **WebCodecs + mp4box.js + mp4-muxer.** Works, but it is two libraries with different
   models, and mp4-muxer has been superseded by Mediabunny (same author).
3. **ffmpeg.wasm for everything.** One tool, any codec, but slow, memory-hungry, and
   non-viable on iOS for our file sizes.
4. **WebCodecs primary, ffmpeg.wasm fallback** (the original brief). The fallback would
   only ever run where WebCodecs is missing — in practice Firefox for Android — and those
   are phones where ffmpeg.wasm cannot handle 4K clips either. It is maintenance with no
   users.
5. **`<video>` + `requestVideoFrameCallback` for decode, `MediaRecorder` for encode.**
   Available everywhere, but decode is not reliably frame-accurate, encode runs in real
   time, and quality and timing are uncontrolled.

## Decision

Option 1. Mediabunny handles containers; WebCodecs handles codecs. **No ffmpeg.wasm.**

- Input: `BlobSource(file)`. Decode in the worker, with a bounded number of frames in
  flight. Every `VideoFrame` is `close()`d as soon as it has been downscaled or drawn.
- Output: H.264 High at source resolution and fps via `VideoEncoder` (hardware
  preferred), with a 1080p fallback if `isConfigSupported` rejects the source size. MP4
  via Mediabunny, streamed to an OPFS file. Audio packets are copied, not re-encoded.
- Browsers without WebCodecs, or without a decoder for the clip's codec, get a clear
  explanation rather than a degraded path.
- Minimum engine: Safari 16.4. The video-only WebCodecs of 16.4–18.x is enough because
  audio is copied rather than decoded.

## Consequences

- Firefox for Android is unsupported, and so is HEVC on browsers without an HEVC decoder.
  The app says so, and suggests re-exporting as H.264 or switching the iPhone camera to
  "Most Compatible".
- We own `VideoFrame` lifetimes and backpressure; leaks there are memory leaks on iOS.
- Output is always H.264 SDR for maximum playback and sharing compatibility. **Open risk:**
  HDR input may look washed out after the canvas round trip. The M0 spike measures this, and
  the answer may be explicit tone-mapping or HEVC Main10 output where supported.
- Mediabunny is MPL-2.0: file-level copyleft, compatible with our MIT code as a
  dependency. Any file of Mediabunny we modify stays MPL-2.0.
- **Revisit** if the M0 spike finds a WebCodecs gap on iOS (e.g. no 4K H.264 encode).
  First answers would be 1080p export or HEVC output, not ffmpeg.wasm.
