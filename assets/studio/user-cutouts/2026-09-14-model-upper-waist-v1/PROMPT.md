# Model upper waist repair

## User-visible defect

Remove the long triangular skin-colored alpha sliver hanging from the model's
right waist beside the hand. Preserve the 1024 x 1536 canvas, pose, alignment,
hand, arm, jewelry, face, hair, color and all unaffected pixels.

## Implementation

The built-in image editing tool was attempted first, but its filesystem sandbox
could not read the referenced runtime image. Because this is an isolated alpha
geometry defect, the candidate is produced deterministically by clearing only
the measured defect mask. No RGB content is generated or repainted.

The archived uncut source and editable mask are source-bound to the hashes
recorded in `manifest.json` after candidate generation.
