# 0001. Everything runs client-side; no backend

- **Status:** Accepted
- **Date:** 2026-09-12

## Context

Users bring an existing clip of a golf shot, typically shot on a phone at 4K60, 150–300 MB,
and want it back with a tracer line. The processing is a few passes of classical CV plus a
re-encode; all of it has browser implementations (WebCodecs, OpenCV.js in WASM).

Uploading 300 MB over a mobile connection takes minutes, often longer than processing the
clip on the phone itself. A server also brings object storage, egress, a job queue,
accounts or rate limits to stop abuse of free processing, a monthly bill, and personal data
(videos of identifiable people) under GDPR.

## Options considered

1. **Server-side processing.** Upload, process with native OpenCV/ffmpeg on a GPU or CPU
   worker, download the result. Fastest per frame and one controlled environment, but all
   the costs above, and privacy becomes a promise instead of a property.
2. **Hybrid.** Decode and downscale on the device; upload only small analysis frames or
   candidate lists; fit on the server. Smaller uploads, but it still needs a backend and
   accounts, still ships user-derived data off the device, and splits the pipeline across
   two runtimes.
3. **Fully client-side.** Decode, analyse, render and encode in the browser. Deploy as a
   static bundle.

## Decision

Option 3. There is no backend: no API, no storage, no accounts, no analytics that receive
video-derived data. The app is a static bundle and works offline after the first load.

## Consequences

- Hosting is free and effectively unlimited. There is nothing to scale, secure or pay for.
- **Privacy is structural:** videos never leave the device, because there is nowhere to
  send them. This is a selling point against every other app in this space and should be
  stated in the UI.
- We are bound by browser capabilities, especially iOS Safari's: codec support, silent
  per-tab memory kills, no threads without cross-origin isolation. Memory becomes the
  binding design constraint (ARCHITECTURE §8).
- Performance varies with the user's device; old phones will be slow.
- We never see failing user clips. Tracker quality depends entirely on our own fixture set
  ([docs/TESTING.md](../TESTING.md)), so the fixture set must be deliberately diverse. Any
  future "send us this clip" feature would need explicit opt-in, and it would reopen this
  ADR.
- First load includes the CV runtime (~11 MB). It is precached for offline use afterwards.
- **Revisit** only if a hard blocker appears — e.g. the M0 spike shows iOS cannot decode or
  encode 4K at all. In that case the project owner decides before anything is designed
  around it.
