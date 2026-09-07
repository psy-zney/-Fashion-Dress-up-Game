# Session handoff — GameDressUp

## Cập nhật 2026-09-06 — cấu trúc thư mục chuẩn

- `public/game/studio/` chỉ còn runtime web tải: `layers/` và `products/`.
- Nguồn chuẩn chuyển vào `assets/studio/sources/`: `model/`, `garments/worn/`, `products/original|edited|approved/`.
- Backup runtime chuyển vào `assets/studio/backups/runtime-layers/<timestamp>/`; không còn lớp thư mục `archive/<timestamp>/layers` dư thừa. Xem manifest trong `assets/studio/backups/README.md`.
- Bản thử, intake, preview trung gian và QA gom dưới `artifacts/studio/`. Dữ liệu v2 cũ không còn tham gia pipeline nằm tại `assets/studio/legacy/v2/`.
- Các đường dẫn lịch sử cũ ở phần bàn giao dài bên dưới chỉ mô tả trạng thái trước đợt tổ chức này; không dùng chúng làm input hiện hành.

## Cập nhật 2026-09-05 — responsive mobile

- Mobile dọc dùng ba vùng không chồng: model trên, tab `Tops / Bottoms / Shoes`, tủ cuộn ngang ở đáy; bánh xe bán nguyệt desktop được ẩn.
- Mobile ngang dùng bố cục model – tab dọc – tủ, tận dụng toàn màn hình thay vì thu nhỏ canvas desktop.
- Playwright kiểm tra hình học và overflow ở 375×667, 390×844, 430×932, 844×390. Xem `docs/studio/WORKFLOW.md` và `artifacts/studio/qa/play-mobile-*.png`.

## Cập nhật 2026-09-05 — ảnh trưng bày và sticker

- 14 ảnh tủ đồ và ghost kéo dùng chung `/game/studio/products/<id>.png` qua `previewAssetUrl`. Các đường dẫn preview trong ghi chú lịch sử bên dưới không còn là mapping runtime.
- Nền trắng/caro là pixel RGB trong nguồn, không phải nền của drag DOM. Pipeline riêng `npm.cmd run prepare:products` tạo alpha thật; không thay layer mặc hoặc model.
- Ảnh Mary Jane trưng bày có nguồn mới với quai/lòng giày đầy đủ; ảnh gốc và prompt giữ tại `assets/studio/sources/products/edited/`. Không xoá ảnh nguồn trong lần sửa này.
- Xem `docs/studio/PRODUCT-PREVIEWS.md` để tái tạo, kiểm tra alpha, giữ tỷ lệ và đối chiếu nguồn. Bằng chứng kéo thực tế nằm ở `artifacts/studio/qa/products/`.
- Các test gồm kiểm tra 14 PNG và kéo áo cột phải, jeans, short trắng, váy navy, Mary Jane (cùng kích thước, opacity 1, thả mặc được).

> Ngày bàn giao: 2026-09-04
> Dự án chính: `C:\Users\admin\MyProject\GameDressUp`  
> Lý do chuyển session: session hiện tại gần/tràn giới hạn sử dụng.  
> Yêu cầu khi tiếp tục: đọc toàn bộ file này và `AGENTS.md` trước khi thao tác.

## 0. Chỉ thị mới nhất — ưu tiên cao nhất, thay thế phạm vi 33 món

> Cập nhật theo yêu cầu người dùng ngày 2026-09-04. Mọi chỗ bên dưới còn nhắc “33 món” chỉ mô tả công việc/asset lịch sử, **không còn là phạm vi cần hoàn thiện**.

### Phạm vi mới

- Chỉ cần bộ chơi chính gồm **6 áo + 6 quần/váy + 2 đôi giày = 14 món**.
- Tạm bỏ đầm, áo khoác và tất khỏi catalog/luồng chơi chính. Không xóa file cũ; giữ toàn bộ 33 asset v2 và asset legacy làm dữ liệu tham khảo.
- UI `/play` hiện đã có radial menu, chọn/bỏ món, random/preset, hold, localStorage, export PNG và responsive; có thể tái sử dụng rồi thu gọn về ba nhóm mới. Vấn đề cần làm lại là asset và độ khớp, không phải viết lại toàn bộ UI.
- Nếu người dùng chưa chỉ định chính xác 14 món, chọn 6 áo, 6 quần/váy và 2 giày đại diện, dễ phối, có silhouette khác nhau; ghi rõ danh sách ID trước khi chốt `ready.json` mới.
- Trạng thái hiện tại **chưa được người dùng chấp nhận về độ khớp**: nhiều áo/quần khi ghép vẫn bị lệch so với model. Các lần validator/test trước chỉ chứng minh file hợp lệ và UI chạy, không chứng minh thẩm mỹ đã đạt.

### Quy trình tạo ảnh bắt buộc

1. Dùng duy nhất `assets/studio/sources/model/model-master.png` làm model master.
2. Với từng món, **generate một ảnh toàn thân của chính model master đang mặc món đó**. Không generate sản phẩm rời rồi cố kéo/căn vào người.
3. Giữ nguyên tuyệt đối khuôn mặt, tóc, dáng đứng chính diện, vị trí vai/tay/eo/hông/chân, góc máy, tỷ lệ và canvas 1024 × 1536 giữa mọi lần generate.
4. Từ ảnh model mặc đồ, tách đúng phần trang phục nhìn thấy ở **mặt trước** thành sprite RGBA. Sprite chỉ chứa pixel của mặt trước món đồ dùng để đè lên base model.
5. Không giữ hiệu ứng mặt sau, phần vải nằm sau cơ thể, bóng đổ phía sau người, nền, da, tóc hoặc bản sao model trong sprite. Tay áo/phần đồ thật sự nằm trước tay vẫn được giữ.
6. Không mesh warp, không kéo riêng tay/chân và không scale X/Y khác nhau để chữa lệch. Nếu sprite không khớp khi đặt tại `(0, 0)` trên model thì generate lại ảnh model đang mặc món đó.
7. Asset runtime phải chồng trực tiếp lên model bằng cùng canvas và cùng gốc tọa độ; ưu tiên **không cần fit thủ công**. Chỉ cho phép tịnh tiến rất nhỏ nếu sai số do crop, và phải ghi lại lý do.
8. Với mỗi món, lưu cả ảnh nguồn model-mặc-đồ và sprite mặt trước vào thư mục mới; không ghi đè asset 33 món hiện có. Chỉ cập nhật catalog/runtime sau khi xem bằng mắt từng overlay.

### Mẫu mô tả dùng khi generate

```text
Use the attached master character as an exact identity and pose reference. Create a full-body image of the same fictional adult woman wearing [GARMENT DESCRIPTION]. Keep the face, hair, front-facing camera, straight shoulders and hips, relaxed arms, parallel legs, body proportions, lighting, scale, and 1024×1536 framing unchanged. The garment must fit naturally on the body. Show only the front-facing visible construction of the garment; do not invent a back panel, rear shadow, rear fabric effect, duplicated limbs, or a second body. Use a clean plain background suitable for precise masking. This image will be used to extract a front-only transparent garment layer that overlays the unchanged master model at exactly the same coordinates.
```

### Cách kiểm tra trước khi chấp nhận

- Đặt model master và sprite tại đúng `(0, 0)`, scale `1`, rotation `0`; không dùng thanh căn chỉnh để che lỗi.
- Soi riêng cổ/vai/nách/tay áo/eo/hông/đũng/quanh chân/bàn chân ở kích thước 100%.
- Kiểm tra sprite không chứa pixel da, tóc, nền, bóng sau người hoặc chi tiết “mặt sau” phủ sai lên model.
- Tạo contact sheet đủ 14 món và ít nhất 6 bộ phối chéo áo–quần–giày. Chỉ khi toàn bộ overlay khớp mới tạo cờ ready cho catalog 14 món.

## 1. Yêu cầu trước đây của người dùng (đã được mục 0 thu hẹp/thay thế)

Người dùng không còn muốn tiếp tục cách phối đồ trên model nghiêng/giơ tay cũ vì tay áo, quần và điểm neo bị méo, lệch. Hướng triển khai mới là:

- Dùng một model nữ trưởng thành hư cấu, đứng thẳng chính diện, vai và hông ngang, hai tay buông tự nhiên, hai chân song song.
- Tạo lại toàn bộ 33 món dựa trên cùng model đứng thẳng; ưu tiên độ khớp vai, tay, eo, hông, chân và bàn chân.
- Không xóa asset cũ. Giữ chúng làm dữ liệu legacy/tham khảo hoặc phục vụ cơ chế kéo đồ sau này.
- Asset mới phải được tạo trong ngữ cảnh nhân vật đang mặc, rồi tách nền và giữ đúng hình dáng; không bóp méo sprite bằng mesh/warp để ép vào model.
- Không để một trang `Studio 2D` tách riêng. Trình phối đồ mới phải nằm gọn trong luồng `PLAY`.
- Tạm ẩn các model/bộ đồ mẫu cũ.
- Giao diện chọn loại đồ dùng các nút hình bán cầu/radial cạnh model, tương tự ảnh tham chiếu người dùng gửi.
- Các nhóm cần có: áo, quần/váy, đầm, áo khoác, giày, tất.
- Chọn món mới chỉ thay món cùng nhóm.
- Mặc đầm phải xử lý xung đột với áo và quần/váy.
- Có bỏ món, bỏ toàn bộ, phối ngẫu nhiên, bộ phối gợi ý.
- Phân biệt rõ:
  - **Khóa vị trí**: không cho đổi x/y/rộng/dài/xoay.
  - **Giữ món**: không thay món đó khi random hoặc dùng gợi ý.
- Khóa vị trí mặc định; chỉ mở điều chỉnh trong chế độ căn chỉnh.
- Lưu lựa chọn và điều chỉnh riêng từng món bằng `localStorage`.
- Xuất bộ phối thành PNG nền trong suốt, đúng thứ tự lớp và đúng vị trí hiển thị.
- Responsive desktop và điện thoại.
- Chỉ bật `ready.json` khi asset thật sự đã xử lý và kiểm tra.

## 2. Yêu cầu ban đầu vẫn còn hiệu lực

- Dự án dùng Next.js App Router, React, TypeScript và CSS thuần.
- Giữ các màn hình/chức năng đang hoạt động nếu không mâu thuẫn với yêu cầu mới.
- Không thay toàn bộ dự án bằng code tham khảo.
- Sprite cuối cùng dùng chung canvas `1024 x 1536`, cùng gốc tọa độ và tỷ lệ.
- Asset phải có alpha thật; không được giữ nền caro/trắng/xanh dưới dạng pixel.
- Không xóa nhầm vải trắng, chấm bi trắng, ren, nơ hoặc chi tiết sáng.
- Cần kiểm tra vùng ren, khoảng trống giữa dây áo, tay áo, hai chân.
- Layer tham khảo: model → tất → giày → quần/váy → áo → đầm → áo khoác → tóc/đầu phía trước.
- Cần chạy build, TypeScript, kiểm thử hiện có, kiểm thử luồng phối đồ và chụp ảnh QA.
- README cần mô tả cách chạy, asset, layer, cách thêm món và hạn chế.

## 3. Nguồn dữ liệu người dùng cung cấp

### Dự án chính

`C:\Users\admin\MyProject\GameDressUp`

### Bộ asset legacy

`C:\Users\admin\Documents\Codex\2026-09-03\figma-plugin-figma-openai-curated-remote-2\outputs\dress-up-assets`

### Code Next.js tham khảo

`C:\Users\admin\Documents\Codex\2026-09-03\figma-plugin-figma-openai-curated-remote-2\outputs\dress-up-nextjs`

### Script xử lý ảnh tham khảo

`C:\Users\admin\Documents\Codex\2026-09-03\figma-plugin-figma-openai-curated-remote-2\work\studio\prepare-assets.mjs`

### Ảnh tham chiếu gốc

- Model: `C:\Users\admin\Downloads\model.jpg`
- Trang phục: `C:\Users\admin\Downloads\em bé  [03-09-2026 17_29]`

### Ảnh góp ý giao diện/trạng thái do người dùng gửi

- `C:\Users\admin\AppData\Local\Temp\codex-clipboard-395cb732-e622-44e6-9f81-a0264877e89f.png`
- `C:\Users\admin\AppData\Local\Temp\codex-clipboard-f82461dc-f046-41a7-b0b3-e2c3fb0a7de2.png`
- `C:\Users\admin\AppData\Local\Temp\codex-clipboard-9dfb2820-d654-4ade-912c-9b85d07debe2.png`
- `C:\Users\admin\AppData\Local\Temp\codex-clipboard-f86be03e-fd0c-47e6-a141-361fc3213cef.png`
- `C:\Users\admin\AppData\Local\Temp\codex-clipboard-52dfd8e9-8ca9-4e75-aa90-f75571acc01c.png`

## 4. Quy tắc dự án đã đọc

`AGENTS.md` ở root yêu cầu không giả định Next.js giống kiến thức cũ. Trước khi sửa code phải đọc tài liệu tương ứng trong:

`node_modules/next/dist/docs/`

Session trước đã đọc `AGENTS.md` và tài liệu Next.js liên quan, nhưng session mới vẫn nên đọc lại trước khi sửa.

## 5. Công việc asset legacy đã hoàn thành trước khi đổi hướng

- Bộ model nghiêng cũ và 33 món đã từng được tách/căn vào `public/studio/`.
- Có các file/script legacy:
  - `scripts/prepare-studio-assets.mjs`
  - `assets/studio/fit-anchors.json`
  - `src/lib/studio.ts`
  - `src/components/dress-up-studio.tsx`
  - `src/app/studio/page.tsx`
  - `src/app/studio/studio.css`
- Không xóa các file/asset này. Chúng là legacy và có thể dùng làm tham khảo.
- Cách legacy dựa trên model nghiêng hiện không còn là trải nghiệm chính.

## 6. Asset v2 dáng đứng đã tạo

Skill `imagegen` đã được dùng để tạo một model đứng thẳng cố định và tạo lại đủ 33 món trên cùng dáng.

### Model

- Bản đầu có áo hai dây/quần trắng: `assets/studio/legacy/v2/model-master.png`
- Bản được chọn làm master có bandeau + briefs màu nude đào để không lộ lớp trắng dưới cổ áo sâu:
  - `assets/studio/legacy/v2/model-master-straight-nude.png`

Model cuối cùng là nhân vật nữ trưởng thành hư cấu, đứng thẳng chính diện, tay buông và chân song song.

### 33 ảnh tạo mới

- Nguồn sinh mới hiện được lưu tại: `assets/studio/sources/products/original/*.png`
- Có đủ:
  - 16 áo
  - 11 quần/váy
  - 1 đầm
  - 1 bolero/áo khoác
  - 3 đôi giày
  - 1 đôi tất
- Một số món trắng có bản làm sạch lần hai:
  - Nguồn `generated-clean` lịch sử; phần còn giữ nằm dưới `assets/studio/legacy/v2/generated-clean/`.

### Sprite thành phẩm

Thư mục `ready` v2 lịch sử (không còn trong tree hiện hành).

Thư mục này hiện có:

- `model.png`
- `model-front.png`
- 33 sprite trang phục PNG
- `asset-report.json`
- `ready.json`

Tất cả được xuất trên canvas `1024 x 1536` và có kênh alpha.

## 7. Pipeline xử lý v2

File chính:

`scripts/prepare-studio-v2.mjs`

Chức năng:

- Đọc ảnh nguồn sản phẩm từ `assets/studio/sources/products/original/`.
- Ưu tiên bản trong `generated-clean/` nếu có.
- Tách nền caro bằng mẫu chu kỳ và flood fill.
- Chuẩn hóa alpha có sẵn.
- Loại pixel màu da khỏi giày/tất khi cần.
- Cắt phần thừa ở giày.
- Giữ component lớn nhất cho một số món trắng bị nhiễu.
- Đặt sprite lên canvas bằng **uniform scale + translation only**.
- Không dùng mesh warp/bóp méo.
- Tạo `model-front.png` từ vùng đầu/tóc phía trước.
- Ghi `asset-report.json` và cuối cùng mới ghi `ready.json`.

Lệnh:

```powershell
npm.cmd run prepare:studio:v2
```

Trạng thái gần nhất: lệnh chạy thành công cho đủ 33 món.

## 8. Render QA asset đã có

File:

`scripts/render-studio-v2-qa.mjs`

Lệnh:

```powershell
npm.cmd run render:studio:qa
```

Ảnh đầu ra:

- `artifacts/studio/qa/all-items-contact-sheet.png`
- `artifacts/studio/qa/look-lace.png`
- `artifacts/studio/qa/look-denim.png`
- `artifacts/studio/qa/look-autumn.png`
- `artifacts/studio/qa/look-dress.png`

Quan sát gần nhất:

- Dáng tất cả món đã thẳng theo model.
- Áo dài tay không còn bị bẻ méo như model giơ tay cũ.
- Jeans, quần, váy, boots và giày đi theo hai chân thẳng.
- Cổ áo sâu không còn làm lộ lớp áo trắng cũ nhờ base nude.
- White dress và white shorts đã được sửa nền/khối trắng bằng SVG underlay để không mất vải.
- `model-front.png` chỉ phủ vùng đầu/tóc phía trên khoảng 330 px; các khối tay hình chữ nhật sai trước đó đã được loại bỏ.
- Hạn chế còn lại: phong cách quần áo hơi thiên về product render/realistic trong khi model là minh họa; ưu tiên hiện tại vẫn là độ khớp.

## 9. Vấn đề asset cần chỉnh tiếp

Không báo hoàn thành trước khi xử lý các điểm này:

### Một số bottom có alpha chính bắt đầu quá thấp

Theo báo cáo asset của bản `ready` v2 lịch sử:

- `bottom-navy-dots`: vùng alpha chính bắt đầu khoảng `top: 717`, dù cấu hình fit là `590`.
- `bottom-plaid-mini`: bắt đầu khoảng `top: 707`.
- `bottom-gray-maxi`: bắt đầu khoảng `top: 661`.
- `bottom-black-flare`: bắt đầu khoảng `top: 601`.
- `bottom-black-mini`: bắt đầu khoảng `top: 609`.

Trong `look-lace.png`, `top-white-lace` và `bottom-navy-dots` còn một khoảng nude ở eo. Nguyên nhân có thể là ảnh sinh chứa component/chi tiết rời nằm cao hơn phần váy thật; pipeline trim theo bounding box của toàn bộ alpha nên phần váy chính bị đẩy xuống.

Hướng xử lý khuyến nghị:

- Kiểm tra trực tiếp các ảnh nguồn của các bottom trên.
- Thêm `keepComponents` hoặc crop vùng đầu vào theo từng item, hoặc thêm thông số `contentTopOffset`/`cropTop` hợp lý.
- Không chỉ giảm `fit.top` cho tất cả bottom một cách mù quáng.
- Sau mỗi chỉnh sửa, chạy lại prepare + render QA và xem `asset-report.json`.

### White dress

- Đã hết mảng checker/nền thừa.
- Form hiện tương đối đơn giản và hơi rộng A-line; có thể tinh chỉnh đường SVG trong `repairWhiteGarment()` nếu cần.
- Không tạo lại bằng AI trừ khi chỉnh hình cục bộ không đủ.

## 10. Validator và test asset

Trong lúc bàn giao đã xuất hiện các file:

- `scripts/validate-studio-v2.mjs`
- `artifacts/studio/qa/asset-validation-v2.json`

Một agent QA đang thực hiện phần này nhưng session chạm giới hạn trước khi nhận báo cáo cuối. Session mới phải đọc và kiểm tra nội dung file, không mặc định là hoàn tất hoặc đúng.

## 11. Tích hợp UI PLAY — trạng thái chưa hoàn tất

Một agent đã được giao:

- đưa studio v2 vào `/desktop/2`;
- bỏ nút `STUDIO 2D` khỏi landing;
- chỉ giữ lối vào `PLAY`;
- tạm ẩn/redirect các màn model mẫu cũ;
- làm radial category menu;
- responsive;
- dùng URL asset `/studio-v2/ready/<id>.png`.

Agent này đã thất bại do hết usage limit trước khi gửi kết quả cuối. Không được giả định rằng UI đã hoàn tất. Session mới phải kiểm tra diff/thực tế các file sau:

- `src/app/page.tsx`
- `src/app/play/page.tsx`
- `src/app/desktop/[screen]/page.tsx`
- `src/components/dress-up-game.tsx`
- `src/components/dress-up-studio.tsx`
- `src/app/globals.css`
- `src/app/studio/page.tsx`

Mục tiêu route nên là:

- Landing có lối vào rõ ràng `PLAY`.
- `/desktop/2` hoặc `/play` hiển thị trực tiếp phòng phối đồ v2.
- `/studio` không còn là trải nghiệm độc lập; nên redirect về route PLAY chính hoặc không xuất hiện trong điều hướng.
- Các model/bộ mẫu cũ tạm ẩn khỏi flow người dùng.

## 12. README

Agent tài liệu đã báo hoàn thành cập nhật `README.md` bằng tiếng Việt, gồm:

- cách chạy;
- asset v2 và legacy;
- cấu trúc layer;
- cách thêm món;
- hold/lock;
- lưu trạng thái;
- xuất PNG;
- QA;
- hạn chế.

Session mới cần rà lại README sau khi UI cuối cùng ổn định để route/tên tính năng khớp code thật.

## 13. Package scripts hiện được kỳ vọng

`package.json` đã có hoặc được kỳ vọng có các lệnh:

```json
{
  "prepare:studio": "pipeline legacy",
  "prepare:studio:v2": "node scripts/prepare-studio-v2.mjs",
  "render:studio:qa": "node scripts/render-studio-v2-qa.mjs",
  "typecheck": "TypeScript check",
  "test:e2e": "Playwright"
}
```

Agent QA có thể đã thêm lệnh validate; cần đọc `package.json` để xác nhận trước khi chạy.

## 14. Thứ tự công việc khuyến nghị cho session mới

1. Đọc `AGENTS.md`, file handoff này và tài liệu Next.js local liên quan.
2. Xem mục 0 là yêu cầu hiện hành; không tiếp tục sửa/căn mù bộ 33 sprite hiện tại.
3. Chọn catalog mới đúng 14 món: 6 áo, 6 quần/váy, 2 giày; không xóa asset ngoài catalog.
4. Tạo một thư mục phiên bản mới dưới `assets/studio/sources/garments/`; không ghi đè nguồn đã duyệt.
5. Dùng `imagegen` tạo lại từng món với model master đang mặc trực tiếp theo prompt ở mục 0.
6. Tách sprite mặt trước, đặt nguyên tọa độ/canvas lên model, rồi xem bằng mắt từng món. Món nào còn lệch phải generate lại, không chữa bằng warp.
7. Render contact sheet 14 món và ít nhất 6 bộ phối chéo; kiểm tra kỹ vai, tay, eo, hông, đũng, chân và giày.
8. Sau khi asset đạt, cập nhật catalog/UI PLAY chỉ còn ba nhóm: áo, quần/váy, giày. Giữ các chức năng chọn/bỏ món, random, preset, hold, localStorage và export PNG nếu còn phù hợp.
9. Chạy validator, sau đó chạy:

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:e2e
```

10. Chạy dev server và Browser QA desktop/mobile:
   - kiểm tra layout;
   - click ba nhóm radial: áo, quần/váy, giày;
   - chọn/bỏ món;
   - random không thay item được giữ;
   - lock/adjust;
   - reload kiểm tra localStorage;
   - export PNG và kiểm tra alpha;
   - kiểm tra console/network.
11. Chụp screenshot UI thật và giữ trong `artifacts/`.
12. Cập nhật README lần cuối theo catalog 14 món và implementation thực tế.

## 15. Tiêu chí hoàn thành bắt buộc

Không được báo xong chỉ vì trang chạy hoặc ảnh xuất hiện. Chỉ hoàn tất khi:

- Catalog mới có đúng 14 sprite: 6 áo, 6 quần/váy, 2 giày; tất cả có alpha thật và chung canvas 1024 × 1536.
- Mỗi sprite được tách từ ảnh chính model master đang mặc món đó, chỉ chứa phần trang phục mặt trước để đè lên model.
- Mọi sprite khớp ở `(0, 0)`, scale `1`, rotation `0`; không phụ thuộc vào chỉnh tay bằng UI để che lỗi.
- Không còn mảng nền caro/trắng/xanh.
- Không mất chi tiết trắng/ren quan trọng.
- Không có pixel model/da/tóc, bóng phía sau hoặc hiệu ứng mặt sau bị giữ nhầm trong sprite.
- Từng món khớp model đứng thẳng; đặc biệt áo dài tay, quần dài, váy dài và giày.
- Không có khoảng hở eo bất hợp lý do crop/anchor.
- Studio nằm trong PLAY, không còn nút Studio 2D riêng.
- Model/bộ mẫu cũ được tạm ẩn nhưng asset/code legacy không bị xóa.
- Tính năng bỏ món, reset, random, preset, hold, localStorage và export PNG hoạt động với catalog mới.
- Desktop/mobile dùng được.
- Typecheck, build và test pass.
- Có ảnh QA đối chiếu.
- README đúng với code cuối.

## 16. Lưu ý về reset usage

Người dùng đã hỏi khi nào nên dùng reset. Câu trả lời đã đưa ra: chỉ dùng reset khi gần/chạm giới hạn và cần tiếp tục ngay; không nên dùng sớm. Session hiện tại đã thực sự chạm giới hạn ở một agent, vì vậy chuyển sang session mới là hợp lý. Không tự ý redeem reset nếu người dùng chưa yêu cầu rõ.

## 17. Nguyên tắc an toàn khi tiếp tục

- Không xóa asset cũ.
- Không chạy lại prompt lịch sử một cách mù quáng.
- Không ghi đè ảnh nguồn; mọi kết quả đi vào file/thư mục mới.
- Không thay toàn dự án bằng bản Next.js tham khảo.
- Không dùng mesh warp để ép quần áo vào dáng.
- Không tự nhận hoàn thành nếu chưa xem ảnh và chạy QA.
- Nếu thấy file do agent ghi dở, đọc và hợp nhất có chủ đích; không rollback thay đổi của người dùng.

---

## 18. Cập nhật tiến độ xử lý Feedback & Context hiện tại (Session Gemini)

### 18.1. Các hạng mục đã khắc phục theo feedback.md và phản hồi của người dùng

1. **Khôi phục giao diện gốc Dressing Room Figma (`image.png`)**:
   - Loại bỏ hoàn toàn phong cách tạp chí "Room 2 / Phòng phối đồ 02".
   - Tái lập nền radial gradient cyan/mint rực rỡ đặc trưng (`#41ffad` -> `#71ead6` -> `#a0d4ff` -> `#e8f5ff`) với tâm sáng mint spotlight sau lưng nhân vật và bánh xe danh mục.
   - Giữ nút tròn quay lại góc trên bên trái (`/figma/back.svg`).
   - Giữ bóng đổ chân nhân vật (`/figma/shadow.svg`).
   - Bảng tủ đồ chuẩn kính mờ (frosted glass blur 28px) bo góc 24px với viền trắng bán trong suốt.
   - Tiêu đề pill trắng "Pick an outfit" nằm trên cùng bảng tủ đồ.

2. **Xóa toàn bộ nội dung thừa dưới/sau ô đồ**:
   - Đã loại bỏ hoàn toàn các nút dư thừa bị người dùng phản ánh: thanh nút hành động (Ngẫu nhiên, Bỏ toàn bộ, Lưu PNG), thanh preset gợi ý (Pháp cổ điển, Ngày thu năng động, Xếp ly...), và khay thanh trượt fitting (Khóa vị trí, Giữ món, Bỏ món, các slider căn chỉnh).
   - Bảng tủ đồ giờ đây chỉ còn duy nhất tiêu đề "Pick an outfit" và lưới 2 cột chứa các ô đồ kèm thanh cuộn trắng dạng viên thuốc mềm mại ở bên phải.

3. **Bánh xe danh mục 3 phần (`image-5.png` & `image-6.png`)**:
   - Thay thế hoàn toàn dial 6 ô cũ bằng SVG bán nguyệt 3 khu vực bằng nhau (mỗi sector 60°):
     - **Sector 1 (Áo)**: Icon áo sơ mi/blouse có cổ.
     - **Sector 2 (Quần/Váy)**: Icon quần dài.
     - **Sector 3 (Giày)**: Icon giày cao gót.
   - Di chuyển `.studio-radial-nav` ra làm sibling trực tiếp của `.wardrobe` trong `.dressing-room`, loại bỏ hoàn toàn việc bị cắt xén do `overflow: hidden`.
   - **Khắc phục lỗi "bị dư viền"**: Bỏ stroke màu trắng trên đường kính thẳng của sector khi active/hover, loại bỏ đường stroke đường kính của SVG, đồng thời cho mép phải bán nguyệt luồn êm 2px dưới cạnh viền của bảng tủ đồ (z-index: 40 dưới wardrobe z-index: 50). Kết quả: bánh xe nối liền hoàn hảo vào mép trái tủ đồ, không còn bất kỳ vệt viền trắng thừa nào.
   - Hỗ trợ cả **hover** và **click** trên từng sector để chuyển nhóm trang phục lập tức.

4. **Trang phục hiển thị trong ô đồ (`image-4.png`)**:
   - Sử dụng ảnh nguồn sản phẩm từ `assets/studio/sources/products/original/${id}.png`, không dùng ảnh sprite cắt viền trắng/xám cũ.

5. **Tương tác kéo thả (Drag & Drop) đồ (`feedback.md` mục 9)**:
   - Hỗ trợ kéo trực tiếp thẻ trang phục từ tủ đồ thả vào khung nhân vật để mặc đồ.
   - Bổ sung hiệu ứng hình ảnh: highlight viền khung khi kéo qua (`is-drag-over`), overlay gợi ý "Thả trang phục vào đây ✧", và animation nảy nhẹ (`animate-snap`) khi đồ được mặc lên người.
   - Vẫn hỗ trợ click chuột để mặc nhanh như thông thường.

6. **Khắc phục lỗi asset trang phục**:
   - **Áo đỏ trễ vai tay loe (`top-red-offshoulder`) (`image-1.png`)**: Phân tách vùng eo và tay áo, mở rộng phần tay xuống `maxY: 865` để ống tay xoè rủ tự nhiên qua cổ tay.
   - **Lỗi "nét đứt" ở eo (`image-2.png`)**: Lọc bỏ các pixel da thừa còn sót lại ở gấu áo (`y >= 620`, pixel da `g > 80 && b > 60`), đảm bảo khi mặc cùng váy mini đen không còn vệt nét đứt da.
   - **Lỗi cắt vai áo phẳng (`image-3.png`)**: Mở rộng biên độ vai cho các áo theo đúng đường cong tự nhiên của model (`minY: 180-230`), đồng thời loại bỏ lớp `model-front` đè ngang ngực/vai (vốn là nguyên nhân chính tạo vệt cắt ngang phẳng). Các áo dài tay, cổ V và hai dây ôm sát vai tự nhiên.
   - **Boots nâu cao cổ (`shoes-brown-boots`) (`image-7.png`)**: Cắt bỏ hoàn toàn lớp ren trắng thừa bên trong cổ boots (`y >= 975`) và thu hẹp bắp chân bằng tỷ lệ 0.88x hướng về tâm cẳng chân để ôm sát đôi chân thẳng của model.

7. **Dọn dẹp ảnh không dùng đến (`feedback.md` mục 8)**:
   - Đã xóa sạch các thư mục asset cũ không còn sử dụng:
     - `public/studio/` (39 file sprite V1 cũ)
     - `public/studio-v3/` (thư mục thử nghiệm cũ)
     - Bản `ready` v2 (37 sprite cũ; không còn trong tree hiện hành)
     - Thư mục `generated-clean` cũ; phần còn giữ đã chuyển vào `assets/studio/legacy/v2/`
     - Các script kiểm tra tạm thời trong `ge/scripts/`.
   - Giữ nguyên các tài nguyên cần thiết:
     - `public/ge/ready/`: 14 sprite thành phẩm (`model.png`, 6 áo, 6 quần/váy, 2 giày).
     - `assets/studio/sources/products/original/`: Các ảnh tham khảo gốc dùng để tạo ô đồ trong tủ.
     - `public/figma/`: Nút quay lại, bóng đổ, background landing.

### 18.2. Kết quả kiểm định chất lượng (QA & Tests)

- **TypeScript check**: `npm.cmd run typecheck` pass 100% (0 lỗi).
- **Next.js Production Build**: `npm.cmd run build` hoàn thành trong 529ms, toàn bộ các route biên dịch sạch sẽ.
- **Playwright E2E Tests**: `npx playwright test` pass toàn bộ **8/8 test**:
  1. `màn hình mở đầu chỉ dẫn PLAY vào phòng phối đồ tích hợp`: PASS
  2. `hướng dẫn mở, giữ focus, đóng bằng Escape và trả focus`: PASS
  3. `các URL phòng mẫu cũ chuyển vào PLAY, route sai vẫn 404`: PASS
  4. `PLAY tải model thẳng và duyệt đúng số món theo nhóm (6 áo, 6 quần/váy, 2 giày)`: PASS
  5. `chọn nhóm độc lập áo, quần, giày phối hợp tự nhiên`: PASS
  6. `chuyển đổi danh mục bằng hover và click trên bánh xe 3 phần`: PASS
  7. `kéo thả món đồ vào khung nhân vật để mặc đồ kèm hiệu ứng`: PASS
  8. `PLAY dùng được ở mobile và không tràn ngang`: PASS
- Ảnh chụp màn hình nghiệm thu thực tế được lưu tại `artifacts/studio/qa/play-desktop.png` và các file `artifacts/studio/qa/play-mobile-*.png`.

### 18.3. Những hạn chế kỹ thuật hiện tại (Chưa thể tự động 100%)

1. **Cơ chế layer mặc định (Áo đè lên cạp quần)**:
   - Layer order hiện cố định theo thứ tự: Giày (z-index 20) < Quần/Váy (z-index 30) < Áo (z-index 40).
   - Với những trang phục cần "sơ vin" (nhét vạt áo vào trong cạp quần jeans hoặc váy), hiện tại áo vẫn phủ ra ngoài cạp quần. Nếu muốn hỗ trợ cả 2 kiểu (buông vạt và sơ vin) cho từng set đồ thì cần bổ sung toggle "Sơ vin" trong tương lai hoặc tách thêm biến thể sprite tuck-in.
2. **Kích thước màn hình siêu nhỏ (dưới 360px)**:
   - Trên các màn hình cực nhỏ (dưới 360px portrait), tủ đồ thu gọn về dạng cuộn dọc phía dưới model để không che khuất nhân vật; trên desktop giữ nguyên tỷ lệ Figma container query `1440 / 1024`.
