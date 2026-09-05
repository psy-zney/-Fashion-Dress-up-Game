# Tưng Tửng — Dress-up game

Game phối đồ dùng Next.js App Router, React, TypeScript và CSS thuần. Phòng phối nằm trực tiếp trong luồng **PLAY**: mở `/`, bấm PLAY và chơi tại `/play`. Các URL mẫu cũ `/desktop/1` đến `/desktop/5` và `/studio` đều chuyển về `/play`.

Runtime hiện dùng một model nữ trưởng thành hư cấu đứng thẳng, chính diện và catalog **14 món**: 6 áo, 6 quần/váy và 2 đôi giày. Model và mọi sprite đều dùng chung canvas 1024 × 1536.

## Chạy tại máy

Yêu cầu Node.js 20.9 trở lên và npm.

```sh
npm ci
npm run dev
```

Mở <http://127.0.0.1:3000> rồi bấm PLAY. Bản production:

```sh
npm run build
npm start
```

## Trải nghiệm PLAY

- Layout desktop bám frame Figma 1440 × 1024: model ở trái, tủ đồ 550 × 898 ở phải.
- Model đứng trên đĩa spotlight; nền và tủ kính co giãn theo cùng một tỷ lệ.
- Nút **Wardrobe** với biểu tượng móc áo là điểm mở duy nhất. Hover hoặc click nút để bung bánh xe Áo — Quần/Váy — Giày; click một sector để đổi nhóm.
- Tủ đồ có vùng cuộn riêng, nên đủ 6 món của mỗi nhóm vẫn xem được trong một viewport.
- Click card để mặc nhanh, hoặc kéo món vào model. Drag dùng ảnh preview, giữ nguyên kích thước DOM và độ đậm, không kéo cả card.
- Chọn món mới chỉ thay món cùng nhóm. Lựa chọn được lưu trong `localStorage` với khóa `tung-tung-play-ge`.
- Boot thay phần chân nền bên dưới cổ giày. Jeans được giấu ống bên trong boot; váy dài giữ nguyên gấu và phủ ngoài boot.
- Khi đủ áo, quần/váy và giày, bấm **Show my look** để chạy hiệu ứng trình diễn 2D.

Workflow tái sử dụng ảnh: [WORKFLOW.md](docs/studio/WORKFLOW.md). Lệnh, cấu hình, bản nháp và phục hồi: [PIPELINE.md](docs/studio/PIPELINE.md). Các tài liệu/mẫu intake không được web import. Không cần chạy lại prepare để khởi động web có sẵn asset.

## Asset đang dùng

| Đường dẫn | Vai trò |
| --- | --- |
| `assets/studio/source/` | Model master và ảnh model-mặc-đồ dùng làm nguồn dựng asset. |
| `public/game/studio/layers/` | Model nền trong suốt, 14 sprite runtime, `ready.json` và `asset-report.json`. |
| `public/game/studio/previews/` | Preview trung gian; boot là nguồn cho products-v2, không còn dùng trực tiếp trên web. |
| `public/game/studio/products-v2/` | 14 ảnh sản phẩm alpha thật, dùng chung cho card và hình kéo. |
| `public/studio-v2/generated/` | Nguồn sản phẩm gốc, không tải trực tiếp vào card/drag. |
| `assets/studio/archive/` | Bản sao layers trước mỗi lần prepare, không được web tải. |
| `public/game/ui/` | Asset UI dùng chung cho landing page và phòng phối đồ. |
| `scripts/studio/` | Pipeline tạo asset và render ảnh QA. |
| `artifacts/studio-qa/` | Screenshot giao diện và ảnh phối kiểm tra hiện hành. |

`scripts/studio/prepare-assets.mjs` tách trang phục từ ảnh model-mặc-đồ, làm sạch checkerboard của model, bỏ các mẩu da/viền tay-chân, giữ cùng gốc tọa độ, tạo preview crop trong suốt và ghi catalog runtime.

Ảnh tủ có pipeline riêng: `npm run prepare:products`. Xem [PRODUCT-PREVIEWS.md](docs/studio/PRODUCT-PREVIEWS.md); không dùng sprite mặc bị lọc da làm ảnh trưng bày Mary Jane.

## Nhóm và thứ tự lớp

Thứ tự mặc định từ sau ra trước:

1. `model`
2. `shoes`
3. `bottoms`
4. `tops`

Riêng `shoes-brown-boots` + `bottom-blue-jeans`, quần được giấu từ tỷ lệ 0.648 và boot chuyển lên z35. Váy dài vẫn ở trước boot. Base `model-boots` ẩn chân nền từ y995. UI, ảnh QA và PNG export nội bộ dùng cùng quy tắc.

## Thêm một món mới

1. Dùng `assets/studio/source/model-master-straight-nude.png` làm tham chiếu. Tạo ảnh **chính model đó đang mặc món mới**, giữ nguyên mặt, tóc, pose, tỷ lệ, camera và canvas 1024 × 1536.
2. Lưu ảnh nguồn vào `assets/studio/source/worn/<id>.png`; nếu là bản sửa, lưu không ghi đè trong `assets/studio/source/worn-v2/`.
3. Thêm cấu hình vùng tách vào `CONFIGS` trong `scripts/studio/pipeline.config.mjs` và metadata vào `src/lib/studio.ts`; điều chỉnh số lượng kỳ vọng nếu thật sự mở rộng catalog. Ưu tiên chạy draft theo PIPELINE.md trước khi thay runtime.
4. Chạy pipeline và QA:

```sh
npm run prepare:studio
npm run render:studio:qa
npm run typecheck
npm run build
npm run test:e2e
```

5. Xem `artifacts/studio-qa/assets/contact-sheet-14-items.png` và các ảnh `artifacts/studio-qa/assets/look-*.png`. Kiểm tra cổ/vai/nách/cổ tay/eo/hông/chân/bàn chân ở 100%, đặc biệt với đồ trắng, ren và boots.

Không dùng sprite dáng nghiêng, không kéo méo tay/chân và không dùng mesh warp để ép một món không khớp model.

## Kiểm tra

```sh
npm run typecheck
npm run build
npm run test:e2e
```

Playwright kiểm tra route PLAY, đủ 6/6/2 món, menu thu gọn, hover/click sector, kéo thả, cuộn tủ đồ, layer boots + mọi đồ dài, mobile và lỗi console/network. Screenshot mới nhất nằm ở:

- `artifacts/studio-qa/play-desktop.png`
- `artifacts/studio-qa/play-mobile.png`

## Giới hạn hiện tại

- Catalog chỉ khớp một model, một pose và một góc máy. Đổi model/pose cần tạo lại ảnh model-mặc-đồ.
- Preview sản phẩm và sprite mặc là hai loại asset khác nhau; tách tự động chưa đảm bảo chất lượng viền/ren của mọi món.
- Pointer Events hỗ trợ chuột/cảm ứng; kéo ngang từ món đồ, cuộn dọc trong tủ, hoặc chạm để mặc nhanh. Cần kiểm tra thêm trên thiết bị thật trước khi phát hành mobile.
- Hiệu ứng trình diễn di chuyển toàn bộ stage; chưa có rig để vẫy tay/đi bộ hoặc xoay lưng.

Nguồn thiết kế: [Dress-up game demo — Figma](https://www.figma.com/design/eDKOctAZqkL4WPmXG63j7K/Dress-up-game-demo_2-1-?node-id=2-3&m=dev).
