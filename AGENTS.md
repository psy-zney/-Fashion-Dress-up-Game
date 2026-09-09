<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Studio asset rules (user correction, 2026-09-09)

- Read `docs/studio/PIPELINE.md` and `docs/studio/REPAIR-PLAN-2026-09-09.md` before changing studio assets.
- Wardrobe/card/drag images in `public/game/studio/products/` are separately supplied artwork. Never replace them with extracted wearing layers. Verify `scripts/studio/product-lock.json` before and after layer work.
- Keep full uncut sources and source-bound editable masks in the archive. Build into candidates first; never let generation or extraction directly overwrite runtime.
- Eyelets reveal model skin, including in showcase/export. Removing the beige base garment must not erase the skin needed beneath openings.
- Preserve red stitching at the modal neckline, both armholes and hem. Review shirt/jeans fit at small display size and edges at mobile 400% zoom.
- State separately whether sources were generated, masks were cut, and runtime was updated. A successful structural check does not mean visual quality passed.
