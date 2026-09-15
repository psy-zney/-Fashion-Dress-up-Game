# Tưng Tửng — Dress-up game

Dress-up game built with Next.js App Router, React and TypeScript. The active
wardrobe is rendered from fixed 1024 x 1536 transparent layers.

## Local development

Requires Node.js 20.9 or newer.

```sh
npm ci
npm run dev
```

Open <http://127.0.0.1:2308>. Production validation:

```sh
npm run studio:audit
npm run check
npm run build
```

`studio:audit` and `check` are read-only. The repository does not contain an
asset-generation, extraction or publishing pipeline.

## Runtime assets

- `src/lib/studio.ts` is the source of truth for the 16-item catalog, layer paths,
  pose selection and z-order.
- `public/game/studio/layers/` contains approved model, garment and showcase
  sprites used by the app.
- `public/game/studio/products/` contains separately approved wardrobe/card/drag
  artwork. Its hashes are locked by `scripts/studio/product-lock.json`.
- `assets/studio/` contains archived uncut sources, prompts, manifests and masks.
  Nothing in this directory is imported by the website.
- `.next/`, `out/`, `artifacts/`, `test-results/`, `.studio-work/` and
  `.studio-history/` are disposable local output. Run `npm run clean` to remove
  them.

Never substitute a body-aligned wearing layer for product artwork. Do not trim,
recenter or independently resize runtime sprites. See
[`docs/studio/RUNTIME-LAYERS.md`](docs/studio/RUNTIME-LAYERS.md) before changing
assets or layer-order logic.

## Current pose rules

- The dressing room uses the complete standing model.
- Show Your Look uses the pose artwork registered for each regular top.
- Add Face keeps the regular top's hands-on-hips pose.
- The strapless deep-fold denim dress is a special branch: Add Face returns to
  the standing model and renders the ordinary dress on top.
- In the special dress showcase, denim leg warmers are sandwiched between the
  complete dress pose and its legless cover. That cover only exists while the
  warmers are selected; high-shaft shoes sit behind the warmers in that sandwich.
- Denim leg warmers cover high-shaft shoes, while bottoms stay above both.

## Tests

```sh
npm run typecheck
npm run test:e2e
npm run build
```

Playwright screenshots are temporary QA output under `artifacts/`; they are not
source assets and are removed by `npm run clean`.
