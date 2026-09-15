# Studio runtime layers

This document describes the current runtime contract. There is no asset-generation
or extraction pipeline in the repository. Source images and source-bound masks are
archived under `assets/studio/`; the website only loads approved files under
`public/game/studio/`.

## Safety contract

- Product/card/drag artwork under `public/game/studio/products/` is independent
  from wearing layers. Never replace it with an extracted wearing layer.
- Run `npm run studio:audit` before and after any product or layer asset change.
  The command is read-only and verifies every product against
  `scripts/studio/product-lock.json`.
- Preserve uncut sources, prompts, manifests and source-bound masks under
  `assets/studio/`. Build caches, QA screenshots and local recovery snapshots are
  disposable and ignored by Git.
- Runtime sprites use a fixed 1024 x 1536 canvas. Do not trim, recenter or resize
  one layer independently.

## Runtime ownership

- `src/lib/studio.ts`: catalog, asset paths, pose selection and z-order rules.
- `src/lib/studio-look.ts`: persisted/exported look composition.
- `src/components/dress-up-studio.tsx`: interactive stage rendering.
- `public/game/studio/layers/`: approved model, garment and pose sprites.
- `public/game/studio/products/`: approved wardrobe and drag artwork.

## Pose branches

- Styling uses the complete standing model (`model-neutral` or its shoes variant).
- Regular tops use their hands-on-hips pose artwork in Show Your Look. Add Face
  keeps that pose branch and overlays the captured face and face frame.
- `dress-strapless-deep-fold-denim` is the only exception. Add Face returns to the
  standing model and renders the ordinary dress over it.
- In the plain special-dress showcase, the core sandwich is complete dress pose
  -> leg warmers -> legless dress-pose cover. With high-shaft shoes it becomes
  complete dress pose -> shoes -> leg warmers -> cover. The cover is active only
  when the warmers are selected and never during Add Face.
- High-shaft shoes render below the denim leg warmers; bottoms stay above both. Other
  wardrobe items keep the normal order declared in `src/lib/studio.ts`.

## Validation

```sh
npm run studio:audit
npm run check
npm run build
```

Structural checks do not approve visual quality. Review affected combinations at
the actual desktop/mobile display size before changing the runtime version.
