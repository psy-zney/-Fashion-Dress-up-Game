# Manual Extraction Handoff — Production v2 White

This is the active full-model production set. Every asset is a lossless
1024×1536 PNG on a clean white studio background. The model and garments have
not been automatically segmented or connected to the game runtime.

## Files

1. `item/00-Party-Model-Base-White-Background.png`
2. `item/01-Fitted-Denim-Top-White-Background.png`
3. `item/02-Modal-Grommet-Top-White-Background.png`
4. `item/03-Sculpted-Balloon-Jeans-White-Background.png`
5. `item/04-Sculpted-Denim-Maxi-Skirt-White-Background.png`
6. `item/05-Colorblock-Party-Platform-Boots-White-Background.png`

The compact chin-length bob is intentionally kept as one connected silhouette
close to the head, cheeks and neck, with no flyaway pieces. This makes manual
background/model removal more reliable.

## Manual cutout contract

- Keep the original 1024×1536 canvas and model coordinates.
- Delete only the model and white background by hand.
- Preserve stitching, fold shadows, fine denim fibers, hardware, hems, hair
  edges and antialiased garment edges.
- Export lossless RGBA PNG with the original stem plus `-Manual-Cutout`.
- Review at 100% and mobile zoom before moving a cutout into the game runtime.

Exact built-in ImageGen prompts are stored in `prompts/`.
