# Photoshoot and garment overlap fixes

`Show my look` opens `/photoshoot` after selecting a top, bottom and shoes.
The Figma background and camera icon are local assets in `public/game/photoshoot/`.
Camera frames and the dressed character are composited locally and saved as PNG.
Camera capture needs HTTPS (the GitHub Pages deployment) or localhost.

The outfit, per-item fit and held categories persist under `tung-tung-play-ge`.
`src/lib/studio-look.ts` validates the saved data and renders the same layer order
as the dressing room. A session copy also supports navigation if storage fails.

## Arms and fabric

Forearms/hands render at z38, above bottoms and tucked boots, below tops/sleeves.
The studio SVG, PNG compositor and asset QA renderer share the contour from
`src/lib/studio-geometry.json`.

The sculpted jeans and ivory knit use source-aligned SVG extraction masks in
`assets/studio/masks/`. Their original worn images remain unchanged. These masks
exclude detached skin contours and preserve continuous fabric, including warm
stitching and knit shadows that color-difference extraction had removed.

To regenerate only these two sprites (the script backs up runtime layers first):

```sh
node scripts/studio/prepare-assets.mjs bottom-sculpted-jeans top-ivory-pointelle
```

## Verification

```sh
npx playwright install webkit
npm run test:e2e
npm run build
```

Tests include pixel checks for skin remnants/fabric holes, outfit persistence,
camera composition and selfie mirroring, download, permission failure, camera
cleanup, and touch navigation in Android Chrome and iPhone WebKit emulation.
Hardware camera behavior still needs testing on an actual device.

## Custom face composition

The face camera stores a normalized 160 × 190 transparent portrait texture. It
does not bake the model hair, hat, glasses or earrings into the captured image.
Those accessories render above the face through
`model-face-accessories-safe.png`. That overlay is deterministically cut from
the archived `model-dressed-upper.png` source; the center of the neck is kept
clear so no synthetic hair fringe can appear below the chin.

`src/lib/face-composite.ts` is the shared geometry contract for the live guide,
studio preview, polaroid and `renderLook()` export. A saved custom face always
switches the character to the neutral, hands-down `face-safe-neutral` pose;
dramatic denim/modal showcase sprites remain available only when no custom face
is active. This prevents pose hands from covering the replacement face. The
camera uses the same upright geometry and supports direct drag-to-pan plus the
sliders for fine adjustment. Captures are versioned; an older crop is ignored
rather than stretched into the current geometry.

Rebuild the accessory overlay into a candidate release before installing it:

```sh
node scripts/studio/build-face-accessory-overlay.mjs --release=face-safe-v5
node scripts/studio/build-face-accessory-overlay.mjs --release=face-safe-v5 --install
```

The installer verifies `scripts/studio/product-lock.json` before and after the
runtime update and refuses to overwrite an existing runtime overlay.
