# Pipeline thực thi và cấu trúc file

**Cập nhật preview:** web dùng cả 14 ảnh trong `public/game/studio/products-v2/`; tạo bằng `npm.cmd run prepare:products`. `public/studio-v2/generated/` và `public/game/studio/previews/` là nguồn hoặc kết quả trung gian, không còn được card/drag tải trực tiếp. Xem [PRODUCT-PREVIEWS.md](PRODUCT-PREVIEWS.md).

## Bản đồ dữ liệu

```text
Ảnh model master + ảnh tham chiếu món đồ
  → intake + prompt (docs/artifacts, không được web tải)
  → công cụ sinh ảnh → nguồn worn phiên bản mới (assets)
  → prepare-assets.mjs → layers 1024×1536 + previews crop
  → validate-assets.mjs → báo cáo cấu trúc
  → render-qa.mjs → 8 phối chéo + contact sheet
  → duyệt bằng mắt → chép đúng asset đã chọn vào public
  → typecheck + build + E2E → kiểm tra web và bàn giao
```

| Đường dẫn | Vai trò | Web tải? |
| --- | --- | --- |
| `assets/studio/source/` | Model và nguồn để tái tạo | Không |
| `assets/studio/archive/<timestamp>/layers/` | Runtime trước mỗi lần prepare | Không |
| `docs/studio/` | Workflow, cấu trúc, intake | Không |
| `scripts/studio/` | Công cụ chạy thủ công | Không |
| `artifacts/studio-candidates/` | Đầu ra thử nghiệm nếu chọn chế độ draft | Không |
| `artifacts/studio-qa/` | Contact sheet, look, screenshot, báo cáo | Không |
| `public/game/studio/layers/` | Model, model-boots và 14 sprite active | Có |
| `public/game/studio/previews/` | Preview crop; hiện chỉ nhóm giày active | Có với giày |
| `public/studio-v2/generated/` | Ảnh sản phẩm đã khôi phục | Có với áo/bottom |
| `src/lib/studio.ts` | Catalog, URL và layer order | Có |

## A. Chạy draft hoàn toàn tách khỏi web

Từ thư mục gốc project, dùng PowerShell:

```powershell
$env:STUDIO_OUTPUT_ROOT = 'artifacts/studio-candidates/review-01'
npm.cmd run pipeline:studio
Remove-Item Env:STUDIO_OUTPUT_ROOT
```

Lệnh cuối chỉ bỏ biến môi trường của terminal, không xoá file. Bản đầu tiên ở một output root mới phải chạy toàn catalog để có đủ model, sprites và báo cáo. Nếu lệnh lỗi, vẫn bỏ biến môi trường trước khi tiếp tục thao tác runtime.

Pipeline chạy prepare → validate → render theo thứ tự và dừng khi một bước trả exit code khác 0. Mỗi script dùng chung PATHS từ config. Báo cáo QA vẫn nằm trong `artifacts/studio-qa/`; xem timestamp để biết đang đánh giá bản draft hay runtime. Không chạy hai pipeline đồng thời vào cùng output root/QA directory.

## B. Chạy sửa chọn lọc trên runtime

Chỉ dùng sau khi đã duyệt nguồn và thông số. Lệnh này **có đổi web**:

```powershell
node scripts/studio/prepare-assets.mjs bottom-navy-dots bottom-gray-maxi shoes-brown-boots
npm.cmd run validate:studio
npm.cmd run render:studio:qa
```

Prepare sao lưu thư mục layers hiện có trước khi ghi. Với ID chọn lọc, nó giữ report của các món còn lại; đồng thời tạo lại model/model-boots. Preview sản phẩm gốc trong `public/studio-v2/generated` không bị ghi đè. Khi chạy không có ID, toàn bộ 14 lớp được xử lý lại. Không dùng bản rebuild đầy đủ chưa duyệt để thay bản đẹp đang chạy chỉ vì validator pass.

## C. Thông số extraction

Mỗi item trong CONFIGS gồm category/name, min/max X/Y, threshold và các tuỳ chọn. Đơn vị là pixel trên canvas gốc, không phải CSS pixel.

- `threshold`: độ chênh kênh màu tối đa giữa master và worn để coi là khác. Không bù được sai pose.
- `neckMinY/neckX`: tránh lấy cổ/da ở cổ áo mở.
- `waistMaxY/waistX`: giới hạn thân áo nhưng vẫn giữ tay dài hai bên.
- `filterSkin`: lọc màu da mạnh, cần xem lại trên đồ kem/hồng/nâu.
- `filterBodyArtifacts`: lọc màu ấm mạnh hơn, có thể làm mất bóng vải; không bật mặc định cho mọi món.
- `onlyNeutral`: loại màu quá bão hoà/tối ngoài phạm vi của đồ trắng.
- `onlyDark`: dùng cho boot; giữ highlight đến mức sáng 235. Ngưỡng 178 cũ từng khoét thủng mũi giày.
- `keepLargestComponent`: loại mảnh rời; không áp dụng mù quáng cho đôi giày hoặc nhiều phần ren rời.
- `fillBetweenEdges`: bổ sung pixel nguồn giữa biên vải từng hàng; chỉ phù hợp vùng vải liên tục đã kiểm duyệt, không áp dụng cho khoảng trống giữa hai chân/ống tay.
- `preserveContinuousFabric`: bỏ lọc đoạn ngắn theo hàng và dark-noise trên váy để tránh vệt đứt.
- `trimLightExterior`: chỉ bỏ vùng sáng nối thông với phần ngoài sprite; dùng cho váy navy/xám để dọn nền trắng dưới gấu, vẫn giữ chấm trắng nằm bên trong vải.
- `previewPalette`: bộ lọc thử cho preview crop; không đảm bảo giữ đủ ren/vải trắng. Preview cần duyệt riêng.

Nguồn RGB/RGBA được chuẩn hoá về RGB trước phép so sánh; tránh lỗi dùng stride 3 cho ảnh 4 kênh. Sprite output luôn RGBA. Model dùng tách nền kết nối từ ngoài; không xoá trắng bên trong quần áo.

## D. Duyệt và đưa draft vào runtime

1. Mở contact sheet và 8 look, đặc biệt navy/gray/white + boots. Xem cả pixel biên và silhouette.
2. Ghi trạng thái từng item vào intake. Không dùng “pass tự động” thay phần quan sát.
3. Giữ nguồn được chọn và cấu hình đi kèm. Nếu đổi boot, luôn chuyển cả boot sprite **và** model-boots cùng phiên bản.
4. Sao lưu runtime rồi chép các file đã chọn. Không xoá cả public để triển khai một món.
5. Cập nhật catalog/URL chỉ khi thêm món thật. Khi chỉ thay sprite có cùng ID, URL không đổi; kiểm tra reload và cache.
6. Nếu chưa duyệt preview crop, tiếp tục dùng preview sản phẩm gốc.

## E. Xác minh sau tích hợp

```powershell
npm.cmd run validate:studio
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:e2e
```

Validator kiểm tra canvas, alpha, vùng hiển thị, số món 6/6/2, mapping catalog, preview padding, metadata. E2E kiểm tra route/Help, duyệt nhóm, chọn/mặc, tương tác menu, ghost giữa lúc giữ chuột (độ đậm và kích thước), thả ngoài/vào stage, scroll, mobile không tràn ngang, boot model và show-look. Screenshot trong `artifacts/studio-qa/`. Kiểm tra thêm touch thực trên thiết bị nếu chuẩn bị phát hành: `touch-action: pan-y` giữ cuộn dọc, kéo ngang từ hình để bắt đầu mặc.

Kiểm tra tay tối thiểu ở 390×844, 768×1024, 1440×1024 và màn hình rộng 1920×1080. Một test viewport nhỏ pass không tự chứng minh mọi kích thước đều đẹp. Chuyển động là cả stage cùng nhau, không thay đổi toạ độ sprite.

## F. Phục hồi

Đọc timestamp trong `assets/studio/archive/`, chọn đúng bản trước khi lỗi; chép từng file cần dùng từ `layers/` của bản đó về runtime. Khi đổi boot cần ghép đúng `model-boots.png`. Archive tạo trước lần đầu có thể chưa có model-boots. Ảnh sản phẩm gốc và nguồn worn được giữ độc lập. Không xoá archive/cache hoặc làm rỗng Recycle Bin trong lệnh prepare/validate/render.

Giới hạn hiện tại: pipeline là tách ảnh theo heuristic, chưa có mask vẽ tay cho mỗi item; một số source cũ còn viền trắng/khác da ở mức pixel. Các file draft hoặc ảnh gen mới không được tự phát hành. Để có chuyển động tay/chân thật, phải bổ sung rig/pose assets; hiệu ứng stage hiện tại không sinh thông tin mặt sau của trang phục.
