# Manual Extraction Handoff — Production v1

These are lossless 1024×1536 PNG full-model renders. They are deliberately **not**
connected to the game runtime and have not been automatically segmented,
resized, sharpened, blurred or cleaned. Remove the model/background by hand.

## Files

1. `00-Party-Model-Base-Full-Body.png`
2. `01-Fitted-Denim-Top-Full-Model.png`
3. `02-Modal-Grommet-Top-Full-Model.png`
4. `03-Sculpted-Balloon-Jeans-Full-Model.png`
5. `04-Sculpted-Denim-Maxi-Skirt-Full-Model.png`
6. `05-Colorblock-Party-Platform-Boots-Full-Model.png`

Exact generation prompts are retained in `prompts/` with matching English names.

## Manual cutout contract

- Keep the original 1024×1536 canvas; never crop or move the garment.
- Delete only the model and background. Preserve stitching, dark fold shadows,
  fine denim fibers, hardware, hems and antialiased garment edges.
- Do not erase dark pixels merely because they resemble an outline: the denim
  panel seams and occlusion shadows are real garment detail.
- Export lossless RGBA PNG using the same filename stem plus `-Manual-Cutout`.
- Do not place a cutout in `public/game/studio/` until it has been reviewed at
  100% and mobile zoom for stray skin, missing fabric and dotted edges.

