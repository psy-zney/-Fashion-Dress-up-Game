# Studio asset structure

`assets/studio/` contains source and recovery material. Nothing here is loaded directly by the website.

```text
assets/studio/
├─ sources/
│  ├─ model/model-master-v2.png       # active photoreal 1024×1536 model
│  ├─ garments/worn/<item-id>.png     # approved full-model worn sources
│  └─ products/
│     ├─ original/<item-id>.png       # original product references
│     ├─ edited/<name>-vN.png          # edited/generated sources + prompt
│     └─ approved/<item-id>.png        # manually approved cutouts
├─ ../../.studio-work/runtime-backups/  # local, ignored runtime snapshots
└─ legacy/v2/                          # historical inputs, not in active pipeline
```

## Naming contract

- Garments use the catalog ID from `src/lib/studio.ts`, for example `bottom-navy-dots.png`.
- A new iteration adds `-v2`, `-v3`, and so on; do not overwrite an approved source while experimenting.
- Backup folders use UTC `YYYY-MM-DDTHH-mm-ss-SSSZ` so names sort chronologically and remain Windows-safe.
- `original`, `edited`, and `approved` describe lifecycle state; they are not interchangeable.
- Runtime output belongs only in `public/game/studio/`. QA and drafts belong only in `artifacts/studio/`.

The active path contract is centralized in `scripts/studio/pipeline.config.mjs` and `scripts/studio/product-preview.config.mjs`.
