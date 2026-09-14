# Model lower short base — built-in imagegen

Use case: precise-object-edit

Asset type: transparent 1024x1536 lower-body sprite for a fashion game

Input images: Edit only `public/game/studio/layers/model-lower.png`. Ignore the other supplied images.

Primary request: Change the beige cycling shorts to plain beige regulation volleyball shorts with a 5 cm inseam.

Constraints: Keep the adult athlete's leg pose, proportions, feet, skin appearance, lighting, exact canvas position, scale, and transparent cutout unchanged. Keep the new shorts opaque, conservative, matte, unbranded, and free of seams or contrasting trim. Preserve exact 1024x1536 alignment. Use true transparency outside the sprite.

Avoid: changing identity, pose, leg shape, camera, crop, or canvas; no text, watermark, checkerboard, or opaque background.

## Generation note

Generated with the built-in `imagegen` tool on 2026-09-13. The built-in result rasterized the transparency checkerboard. The unmodified output is archived as `model-lower-short-checkerboard-source.png`; source-bound masks are created separately and the studio builder removes the rasterized exterior from runtime candidates.
