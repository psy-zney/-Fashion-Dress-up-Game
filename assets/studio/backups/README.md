# Runtime layer backups

Each directory in `runtime-layers/` is a complete snapshot taken immediately before `prepare-assets.mjs` changed the live layer directory. The website never reads these files automatically.

| Snapshot | Material image change relative to previous snapshot |
| --- | --- |
| `2026-09-05T08-26-49-464Z` | Earliest retained release; no `model-boots.png` yet |
| `2026-09-05T08-28-55-345Z` | Updated navy/gray skirts and added `model-boots.png` |
| `2026-09-05T08-30-18-916Z` | Updated brown boots |
| `2026-09-05T08-38-14-119Z` | Updated white pleated skirt |
| `2026-09-05T08-42-48-252Z` | Same image assets as previous snapshot; report metadata changed |

## Restore one asset

1. Select a snapshot deliberately from the table above.
2. Copy only the affected PNG into `public/game/studio/layers/`.
3. If restoring tall boots, restore `model-boots.png` and `shoes-brown-boots.png` from the same snapshot.
4. Run validation, visual QA, typecheck, build and E2E before accepting the restore.

Do not empty these backups as part of prepare, validate, render or build. Retention cleanup must be a separate reviewed action.

`prepare-assets.mjs` only backs up the live `public/game/studio/layers/` target. Draft output roots do not create backups. Before creating a snapshot it compares the PNG fingerprint with the newest snapshot and skips duplicates that differ only in report metadata.
