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
├─ user-cutouts/                        # supplied cutouts and source-bound masks
├─ model/, shoes/, regenerated/         # versioned source batches
└─ legacy/                              # historical inputs
```

## Naming contract

- Garments use the catalog ID from `src/lib/studio.ts`, for example `bottom-navy-dots.png`.
- A new iteration adds `-v2`, `-v3`, and so on; do not overwrite an approved source while experimenting.
- Backup folders use UTC `YYYY-MM-DDTHH-mm-ss-SSSZ` so names sort chronologically and remain Windows-safe.
- `original`, `edited`, and `approved` describe lifecycle state; they are not interchangeable.
- Runtime output belongs only in `public/game/studio/`.
- QA screenshots and local drafts are disposable output under `artifacts/` and are not source material.
- Keep full uncut sources, prompts, manifests and source-bound masks in this archive.

The active path and layer contracts live in `src/lib/studio.ts`. This archive has no executable publishing path into runtime.
