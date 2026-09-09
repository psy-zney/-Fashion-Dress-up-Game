# Pipeline layer hiện hành — 09/09/2026

Kế hoạch sửa từng lỗi và tiêu chí hoàn tất: [REPAIR-PLAN-2026-09-09.md](REPAIR-PLAN-2026-09-09.md). Tài liệu này thay thế các lệnh pipeline cũ.

## Luồng bắt buộc

```text
Product đã cấp riêng → kiểm tra SHA-256 → giữ nguyên byte và URL

Model đúng tọa độ + thiết kế có đủ chỉ đỏ
  → gen/chỉnh nguồn từng phiên bản → lưu ảnh uncut + prompt
  → kiểm tra thiết kế, da nền và pose
  → matte theo đúng hash nguồn + xử lý màu viền trong nguồn được duyệt
  → build vào artifacts/studio/candidates/<release>/
  → QA ghép model: khoen/da, cổ/nách, gấu áo–quần, chỉ đỏ, zoom
  → tích hợp riêng các layer đạt + version/cache/fit migration
  → kiểm tra play/showcase/export và hash product → bàn giao
```

**Build draft không có nghĩa hình ảnh đã đạt.** Pipeline không tự sinh mask, đoán đường biên bằng màu da, làm mịn hàng pixel, tô bù vải hoặc tự chép sang product/runtime.

## Lệnh đang hoạt động

```powershell
npm.cmd run studio:audit
npm.cmd run test:studio-pipeline
npm.cmd run studio:build -- assets/studio/<version>/manifest.json
```

- `studio:audit`: kiểm tra đúng danh sách và SHA-256 của 4 product, đọc version runtime hiện tại. Chỉ đọc file.
- `studio:build`: chỉ nhận các nguồn đã được kiểm tra và mask của chính nguồn đó, xuất layer draft + ảnh trên nền trắng/tối/mint + manifest/hash/report. Không ghi `public/`, không đổi version, không cập nhật ảnh chưa cắt. Thư mục release phải mới, không ghi đè bản thử trước.
- `prepare:production-v2` và `node scripts/studio/run-pipeline.mjs` hiện chuyển tới cùng pipeline; không tham số = audit, không còn cắt và ghi runtime.
- `prepare-assets.mjs` và `prepare-product-previews.mjs` cũ bị chặn ngay từ đầu. Biến môi trường `OVERWRITE_PRODUCTS` không mở lại được đường ghi.

## Manifest và mask

Sao chép [layer-manifest.template.json](layer-manifest.template.json) vào archive của bản đang sửa. Template cố ý chưa chạy được: nguồn áo vàng hiện chưa đạt chỉ đỏ, chưa có bộ mask/da sửa đầy đủ.

Mỗi entry gồm `id`, `status: source-reviewed`, `source.path`, `source.sha256` và `mask.path`, `mask.sha256`. Trạng thái này chỉ xác nhận nguồn đúng thiết kế/tọa độ; không tự xác nhận layer ghép đạt. Không đổi trạng thái cho qua khi chưa xem ảnh.

Nguồn/mask phải nằm trong `assets/studio/`. Tất cả có canvas 1024 × 1536. Mask PNG/SVG dùng **alpha để biểu diễn độ phủ**: ngoài trong suốt, trong đặc, biên chống răng cưa. Không dùng ảnh trắng/đen opaque làm alpha mask. Một cutout RGBA đã xử lý viền được duyệt có thể làm source mà không cần mask thứ hai.

Lấy hash:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath assets/studio/<version>/uncut/<item>.png
```

Ghi hash chữ thường vào manifest. Build từ chối hash sai, source chưa được kiểm tra, id lạ/trùng, kích thước sai hoặc layer không có alpha phù hợp. Không resize/trim tự động. RGB phần vải được giữ nguyên; chỉ alpha thay theo mask. Nếu nguồn còn trắng dính biên, phải sửa màu viền có kiểm soát trong bản nguồn/cutout mới và kiểm tra lại, không coi mask đơn thuần là đủ.

## Dữ liệu và quyền ghi

| Thư mục | Vai trò | Pipeline build được ghi? |
| --- | --- | --- |
| `public/game/studio/products/` | 4 ảnh card/drag hiện có | Không |
| `public/game/studio/layers/` | Bộ đang chạy | Không |
| `assets/studio/<version>/uncut/` | Nguồn chưa cắt, giữ nguyên | Không |
| `assets/studio/<version>/masks/` | Mask chỉnh sửa được, gắn với nguồn | Không |
| `artifacts/studio/candidates/<release>/layers/` | Layer draft cùng tọa độ model | Có |
| `artifacts/studio/candidates/<release>/qa/` | Nền sáng/tối/mint để xem viền | Có |

## QA và tích hợp

Report build luôn mang trạng thái `draft-needs-composite-and-zoom-review`, không có trường pass chất lượng giả. Ảnh QA layer riêng do build tạo **chưa bao gồm** QA outfit, browser pinch zoom, showcase hay export. Các bước này phải được thực hiện theo kế hoạch sửa trước khi tích hợp.

Lòng khoen của ảnh ghép cuối phải opaque và hiện da; cả neutral lẫn showcase/export. Áo nền màu da chỉ giữ khi chưa mặc áo; mặc đồ dùng nền đã phục hồi vùng da cần thấy. Cạp quần phải theo gấu thực, không bóp theo hàng. Giữ đỏ ở cổ/nách/gấu; không viền trắng tại mobile zoom 400%.

Pipeline hiện không có lệnh publish tự động. Sau khi sửa xong nguồn/model/mask và kiểm tra đủ ma trận, bước tích hợp có chủ đích chỉ sao chép các layer đạt và metadata tương ứng, có snapshot để khôi phục. Đây là thao tác thực hiện trong công việc sửa layer đã được người dùng yêu cầu, không phải yêu cầu người dùng duyệt lại từng thao tác kỹ thuật. Không đưa draft hiện có lên game.

Version product độc lập với layer; session preload bám theo hai version. Khi phát hành thay đổi hình học phải xử lý fit cũ/không version và kiểm tra hash ảnh tải thực tế. Version layer hiện vẫn là bản cũ vì chưa phát hành ảnh sửa.
