# Production v2 — 2026-09-09

The game uses the new 1024 × 1536 model and four updated items: fitted denim top, yellow modal grommet top, balloon jeans, and party platform boots. Mary Janes were removed from the catalog and public assets. The denim maxi skirt (04) is withheld from the catalog, presets, saved selection restoration, and preloading; its source image has not been processed.

## Outputs

- `generated/`: built-in imagegen edits and exact prompts. The yellow top has red dashed stitching at the V neck, armholes and hem. The jeans edit restores cloth hidden behind the neutral hands.
- `cutouts/`: tightly cropped PNGs with real alpha, including each item and the two upper-body poses.
- `public/game/studio/layers/`: transparent sprites on the unchanged 1024 × 1536 game coordinate system.
- `public/game/studio/products/`: transparent product previews.
- `artifacts/studio/qa/production-v2/`: dark-background composites, enlarged edge proof and browser screenshots.

Regenerate with `npm run prepare:production-v2`. This uses Sharp, preserves original input images and does not process item 04. Do not use the legacy production-v1 extraction configuration for these assets.

## Poses

Styling uses neutral arms. Show Your Look, the polaroid transition and photoshoot export select `top-fitted-denim-pose` (both hands covering the face) or `top-modal-grommet-pose` (two-finger peace sign). These sprites contain the upper body only. `model-lower` and `model-lower-boots` retain the original legs. The selected pants and shoes are reused. Upper-body poses stay at the model's default alignment; adjustments to the neutral top are restored when returning to styling.

The white-background extraction protects the white cap and face highlights. Soft alpha uses interior edge colors to remove the white matte. The yellow garment uses an explicit contour to retain red stitching. Jeans render over boot shafts, with the platform toes visible below the hems. A separate neutral arm overlay keeps hands in front of the jeans.

Runtime assets previously present at the start of this edit were copied to `.studio-work/production-v2-backup/`.
