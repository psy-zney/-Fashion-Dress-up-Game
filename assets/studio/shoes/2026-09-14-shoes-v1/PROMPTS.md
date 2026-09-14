# Prompt log — shoes v1

Các prompt dưới đây ghi lại intent cuối đã dùng với built-in imagegen. Ảnh product dùng ảnh tham chiếu tương ứng; ảnh worn dùng `model.png` làm edit target và contact sheet product làm tham chiếu thiết kế.

## Prompt chung — product 2.5D

```text
Use case: product-mockup
Asset type: 2.5D wardrobe product source for a fashion dress-up game.
Primary request: Create a polished 2.5D studio product render of a complete matching pair matching the supplied shoe reference.
Scene/backdrop: pure uniform white (#FFFFFF), no floor horizon.
Style/medium: realistic 2.5D product visualization, clean catalog photography with slightly dimensional game-art polish.
Composition/framing: portrait 2:3 canvas intended at 1024 x 1536; both shoes fully visible, one slightly forward in a restrained three-quarter arrangement, centered, large and easy to cut out, unbroken white margin on every side.
Lighting/mood: soft neutral studio light, controlled contact shadow only beneath shoes.
Constraints: exactly two shoes; preserve the reference silhouette, panels, material and color blocking; no feet, legs, person, props, text, labels, brands, trademarks, watermark, checkerboard, crop, blur, halo or clipped details.
```

Chi tiết theo item:

- `shoes-aqua-coral-wedge-high-tops`: aqua/turquoise panels, coral accents, yellow laces, pastel side stripes, perforated toe boxes, concealed wedge.
- `shoes-mint-studded-wedge-sneakers`: pale mint upper, concealed wedge, broad ankle/vamp straps, gold pyramid studs, small eyelets, subtle micro-studs.
- `shoes-pink-aqua-striped-platform-high-tops`: aqua canvas, hot-pink ankle panels, white laces/toe caps, black piping, thick white platform with exactly three pink stripes; remove reference brand/logo.
- `shoes-aqua-wrap-strap-wedge-sneakers`: use only aqua colorway; tonal suede-like panels, concealed wedge, broad wrap strap, tied laces, padded tongue, off-white sole; remove tongue labels.

## Prompt chung — model worn

```text
Use case: identity-preserve
Asset type: full-canvas worn-source alignment image for a 2D fashion dress-up game.
Input images: model.png is the sole edit target; the matching product render is the footwear design reference.
Primary request: Replace only the model's bare feet and minimum necessary ankle area with the matching pair of shoes.
Scene/backdrop: preserve pure white.
Composition/framing: preserve the exact 1024 x 1536 canvas, model scale, x/y position, straight front pose and full-body framing; adapt the shoe design plausibly to the front-facing feet.
Lighting/mood: match model studio light and contact shadows.
Constraints: change only footwear and tiny ankle transitions; preserve identity, face, hair, cap, glasses, earrings, bodysuit, bracelets, hands, body proportions, legs above shoes, camera and background. Keep leg centers and widths fixed. Both soles land at original bottom around y=1503-1506. Do not lengthen, shorten, widen, shift, rotate or separate the legs. Fully enclose both feet with no bare toes or heels. Exactly two shoes; no extra limbs, text, logos, trademarks, watermark, crop, checkerboard, blur or halo.
```

Không có prompt recolor nào được chạy trong batch này.
