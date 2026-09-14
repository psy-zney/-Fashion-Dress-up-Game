# Face composite v1  2026-09-13

## Sources

- `original/model-face-frame-overlay.png`: exact user-supplied image, copied from Codex generated images. It is 1199 � 1312 RGB and contains a baked checkerboard; SHA-256 `ee18b19d36327e606e4b28d203c2a6939387feb0e0962178f17502d82af73792`.
- `generated/model-face-frame-transparent.png`: rejected imagegen background-removal attempt. It still has three RGB channels and a baked checkerboard, so it is archived but never published.
- `generated/foreground-arms-denim-black.png`: generated arms source for the two-hands-over-face pose.
- `generated/foreground-arms-modal-black.png`: generated arms source for the peace-sign/hand-on-waist pose.

## Build and release

`scripts/studio/prepare-face-frame-overlay.mjs` removes only the periodic checkerboard and builds a 1024 � 1536 candidate. `scripts/studio/prepare-showcase-hands.mjs` removes the solid black generation background and clips the foreground hand regions needed above the face frame. Both scripts write candidates and QA under `artifacts/studio/candidates/2026-09-13-face-compose-v1/`; they do not write runtime assets.

The runtime order is pose-swap garment, captured face, face-frame overlay, then the pose-specific foreground hands. Product artwork is not touched.
