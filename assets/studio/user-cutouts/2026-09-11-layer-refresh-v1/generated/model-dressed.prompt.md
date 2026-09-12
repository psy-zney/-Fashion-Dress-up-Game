# model-dressed / 2026-09-11-layer-refresh-v1

Built-in image generation edit of `public/game/studio/layers/model.png`.

Use case: precise-object-edit
Asset type: transparent dressed-base sprite for a 2D fashion layering game.
Primary request: remove only the beige underlayer round collar and arm-opening seam lines; restore natural skin across the neck, upper chest to about canvas y=430, shoulder caps and narrow underarm zones. Keep the opaque beige underlayer covering the rest of the torso, waist, hips and upper legs. Preserve identity, pose, silhouette, scale, coordinates, crop, lighting and 1024×1536 canvas.

The built-in output rasterized a checkerboard background instead of producing alpha. The unmodified output is archived as `model-dressed-checkerboard-source.png`. The pipeline applies `masks/model-alpha-mask.png`, derived from the exact runtime model silhouette, and keeps only the upper section not supplied by `model-lower.png`.
