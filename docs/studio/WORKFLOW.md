# Workflow ảnh và trang phục — Dress Up

Cập nhật 05/09/2026. Đây là tài liệu cho người làm asset/agent tiếp theo; không được import vào web. `SESSION_HANDOFF.md` là lịch sử, còn cấu hình và code hiện tại mới là nguồn xác định hành vi đang chạy.

**Capsule active:** giao diện hiện chỉ dùng 5 món: 2 áo, balloon jeans, váy denim dài ráp cong và Mary Jane. Boot cao cùng catalog cũ được giữ trong source/backup nhưng không còn hiển thị. Đọc [PRODUCT-PREVIEWS.md](PRODUCT-PREVIEWS.md) trước khi đổi ảnh tủ.

## Responsive của phòng phối đồ

- Desktop giữ bố cục Figma: model trái, nút/bánh xe bán nguyệt ở mép tủ, tủ hai cột bên phải.
- Điện thoại dọc (`≤600px`): model chiếm vùng trên; `Show my look`, ba tab trực tiếp `Tops / Bottoms / Shoes`, rồi tủ dạng khay nằm lần lượt phía dưới. Tủ cuộn **ngang** để danh sách không đẩy model khỏi viewport. Không hiện bánh xe bán nguyệt trên mobile.
- Điện thoại ngang (`≤900px` và cao `≤600px`): chia thành ba vùng ngang model – tab dọc – tủ. Không dùng canvas desktop thu nhỏ ở giữa màn hình.
- Các vùng phải không giao nhau và toàn trang không được tràn ngang/dọc. Test responsive chạy ở 375×667, 390×844, 430×932 và 844×390; ảnh QA nằm trong `artifacts/studio/qa/play-mobile-*.png`.
- Khi đổi chiều cao model, tab hoặc tủ, cập nhật đồng thời các mốc trong media query và giữ các assertion hình học ở test. Với tủ dọc, card dùng `touch-action: pan-x`: vuốt ngang để duyệt, kéo dọc lên model để mặc.

## 1. Bắt đầu một lần làm ảnh

1. Xác định đang sửa ảnh nguồn, tách nền, ảnh trong tủ, hay thứ tự lớp. Chụp đúng lỗi trên web trước khi thay ảnh.
2. Đọc `src/lib/studio.ts` để biết capsule đang dùng: 2 áo, 2 quần/váy, 1 giày. Không khôi phục/gen toàn bộ catalog cũ.
3. Đọc `scripts/studio/pipeline.config.mjs` cho canvas, vùng tách, các bộ lọc và đường dẫn. Đọc `PIPELINE.md` cho cách chạy thử riêng.
4. Giữ nguyên model master. Tạo phiên bản nguồn mới, ghi lại ảnh tham chiếu, prompt, kết quả và quyết định chọn/bỏ. Không ghi đè hoặc xoá ảnh nguồn khi đang thử.
5. Copy `intake.template.json` thành một file intake riêng, điền đủ thông tin. Chạy công cụ tạo prompt ở dưới. File intake và prompt không ảnh hưởng giao diện.

```powershell
node scripts/studio/create-intake.mjs docs/studio/intake.template.json artifacts/studio/intake/example
```

Lệnh này tạo `prompt.md` và bản sao intake; nó không gọi dịch vụ sinh ảnh, không tiêu tốn lượt gen và không đổi asset trên web. Sửa nội dung mẫu trước khi thực sự sinh ảnh. Khi đưa prompt cho công cụ gen, phải đính kèm các file được liệt kê; đường dẫn viết trong prompt không tự tải được ảnh.

## 2. Hợp đồng hình học bất biến

| Thành phần | Quy tắc |
| --- | --- |
| Canvas sprite/source worn | 1024 × 1536, hướng dọc, gốc tọa độ góc trái trên |
| Tọa độ mặc mặc định | x=0, y=0, scaleX=1, scaleY=1, rotation=0 |
| Model | `assets/studio/sources/model/model-master.png` |
| Pose | Chính diện, chân đứng thẳng, hai tay xuôi, giữ nguyên camera và silhouette master |
| Crop sprite | Không trim canvas; vùng alpha có thể nhỏ nhưng file vẫn 1024 × 1536 |
| Phóng to web | Tất cả layer cùng một hệ số, stage tỷ lệ 2:3; không fit từng món riêng |
| Preview tủ | Ảnh sản phẩm riêng; được crop/padding, không có tọa độ mặc |
| Drag | Dùng chính preview, lấy kích thước DOM lúc bắt đầu; không dùng kích thước file 1024 × 1536 |

Các mốc nhìn trên master để kiểm tra (gần đúng, không thay cho mask): đỉnh đầu y≈65, vai y≈310, eo/cạp y≈560–660, bàn tay y≈780–865, cổ boot y≈985–995, đế giày y≈1490. Khi một ảnh sinh mới không còn khớp các mốc này, quay lại bước sinh/căn nguồn. Không dùng CSS kéo rộng vai hoặc bóp boot để che lỗi nguồn.

Hộp minX/maxX/minY/maxY chỉ là phạm vi tìm trang phục; nó không phải hình dạng cuối cùng. Khi đổi kiểu tay áo hoặc độ dài váy, phải cập nhật hộp có chủ đích, không cắt bằng một đường ngang xuyên qua vải.

## 3. Chuẩn bị ảnh tham chiếu

Mỗi món có hai vai trò ảnh tách biệt:

- **Model reference:** master quyết định pose, khuôn mặt, tỷ lệ, vị trí bàn tay/bàn chân và ánh sáng.
- **Garment reference:** ảnh món đồ quyết định chất liệu, đường may, độ dài, cổ áo, tay áo, hoạ tiết và màu.

Ưu tiên ảnh sản phẩm chính diện, đủ cả hai tay/đôi giày, không cắt mất gấu. Nếu chỉ có ảnh góc nghiêng thì ghi rõ phần chưa biết trong intake; không tự phát minh mặt sau để làm sprite mặt trước. Giày phải có đủ cả đôi, cùng phối cảnh với bàn chân master.

Lưu nguồn thử vào thư mục phiên bản, ví dụ `assets/studio/sources/garments/iterations/navy-v2/`. Chỉ trỏ `sourceDir`/`sourceFile` tới nguồn đã xem và chọn. Catalog hiện có 14 nguồn mặc đã duyệt trong `worn/` và một nguồn phiên bản cho quần jeans ráp mảnh trong `iterations/`.

## 4. Sinh ảnh với độ thực tế nhất quán

Gen từng món trên master, không gen nhiều bộ đồ chung một ảnh. Chỉ thay trang phục thuộc nhóm đang làm. Yêu cầu bề mặt vải có sợi, độ dày, nếp gấp theo trọng lực, đường may hợp lý; da/ánh sáng giữ nguyên master. Với model minh hoạ hiện tại, độ thực tế cần đồng nhất phong cách. Yêu cầu ảnh người thật hoàn toàn trong một món riêng sẽ gây lệch phong cách dù vải trông chi tiết hơn.

Trong prompt luôn khoá: identity, pose, camera, framing, canvas, body proportions, hand/foot positions; ghi rõ từng chi tiết bắt buộc. Ví dụ áo ren phải có ren cổ **và hai cổ tay**; váy xếp ly phải giữ đầy đủ gấu; boot phải phủ kín cẳng chân nhưng không sinh thêm chân.

Nếu công cụ trả ảnh khác kích thước, ghi nhận và kiểm tra trước. Không resize không đồng đều để ép về 1024 × 1536. Một ảnh đổi pose/camera phải bị loại ngay. Không bắt đầu chỉnh hàng chục ngưỡng tách màu cho nguồn sai hình học.

Lưu mọi kết quả gen được chọn vào project bằng tên phiên bản. Không dùng cache bên ngoài project làm nguồn duy nhất. Cache và archive không được dọn trong bước chạy pipeline.

## 5. Kiểm duyệt nguồn trước khi tách

Mở master và nguồn mới cạnh nhau ở 100%, rồi đối chiếu cùng tọa độ. Kiểm tra mặt, vai, khuỷu tay, đầu ngón tay, eo, hông, đầu gối và hai gót. Trang phục phải ôm/che cơ thể đúng cấu tạo; không được đổi chiều dài chân để vừa đôi giày.

Đánh dấu pass/fail riêng cho: hình học, chất liệu, chi tiết nhỏ, màu, ánh sáng. Chưa đạt một mục thì ghi nguyên nhân và chỉ sửa mục đó trong prompt tiếp theo. Không thay cả prompt/phong cách mỗi vòng vì sẽ mất khả năng đối chiếu.

## 6. Tách sprite và preview

Chạy bản nháp theo `PIPELINE.md`. Script hiện dùng chênh lệch pixel master/source trong hộp cấu hình, lọc màu có điều kiện, giữ component và bổ sung vùng vải giữa hai biên cho một số váy. Đây là heuristic, không phải segmentation hiểu vật thể.

Không dùng một ngưỡng “gần trắng → trong suốt” cho toàn ảnh: nó làm thủng áo trắng và mất ren. Không xoá các đoạn alpha ngắn theo từng dòng trên váy có chấm bi/xếp ly: đây chính là nguyên nhân vệt đứt ngang đã gặp. `preserveContinuousFabric` bật cho ba váy navy/xám/trắng để bỏ bước lọc đó.

Ảnh card/drag được tạo từ `assets/studio/sources/products/`: `original/` giữ ảnh gốc, `edited/` giữ bản chỉnh kèm prompt và `approved/` giữ cutout đã duyệt. Preview tách tự động của pipeline sprite nằm ở `artifacts/studio/generated-previews/`, **không tự thay** vào tủ vì bộ lọc màu có thể làm mất thân áo hoặc ren. Mỗi preview phải được duyệt như một asset độc lập.

## 7. Kiểm tra phối chéo trước khi đưa lên web

Tối thiểu mở 8 look do `render:studio:qa` tạo. Với mọi váy mới, thử cùng cả Mary Jane và boot. Với boot mới, thử short, váy trắng, váy navy, váy dài xám và jeans. Xem trên nền mint của web, nền sáng và nền tối để thấy lỗ alpha/viền trắng.

Vùng rủi ro: hở eo, đầu tay thừa, da dính trong vải, gấu váy đứt, hai cẳng chân lộ ngoài boot, highlight giày bị khoét thủng, chân cũ còn dưới đế. Kiểm tra ở 100% và kích thước thật trên màn hình. Validator chỉ xác minh cấu trúc file; kết quả PASS không khẳng định đẹp/khớp.

## 8. Quy tắc phối lớp và chuyển động

- Mặc định: model → shoes z20 → bottoms z30 → tops z40.
- Boot dùng `model-boots.png`: ẩn chân nền từ y995 trở xuống; boot thay toàn silhouette cẳng chân.
- Váy dài giữ nguyên gấu và phủ trước ống boot. Không biến váy dài thành mini khi chọn boot.
- Jeans + boot: giấu ống dưới tỷ lệ y=0.648, boot z35 phủ trước quần. Web/export/render QA phải cùng quy tắc.
- Drag dùng Pointer Events, ngưỡng 6px, pointer capture, giữ đúng điểm cầm. Chỉ mặc khi thả trong stage; click vẫn mặc nhanh; Escape/hủy pointer/blur phải dọn preview.
- `Show my look` chỉ bật khi đủ ba nhóm; chuyển động 2D tác động lên cả stage để model và trang phục không lệch nhau. Có reduced-motion. Đây chưa phải rig xương cho bước đi, vẫy tay hay xoay người 3D. Nếu cần đổi pose thật, cần bộ pose/layer đồng bộ cho mọi món hoặc một hệ thống rig riêng.

## 9. Chốt một phiên bản

Ghi intake, prompt chính xác, tên ảnh đầu vào/đầu ra, lý do chọn, thông số extraction và ảnh QA. Sau khi duyệt, chỉ chép những sprite cần dùng sang runtime. Giữ bản trước ở `assets/studio/backups/runtime-layers/`. Chạy typecheck, build và E2E sau tích hợp.

Không xoá nguồn/backup chỉ vì web không tham chiếu trực tiếp: chúng cần để sinh lại. Nếu dọn project, lập danh sách trước, phân biệt runtime với nguồn và bản thử; dùng archive phục hồi được. Không dọn Recycle Bin trong workflow này.

## 10. Bảng xử lý lỗi nhanh

| Triệu chứng | Kiểm tra trước | Hướng sửa |
| --- | --- | --- |
| Drag đứng nguyên hoặc không mặc | Pointer capture, rect stage, lost/cancel events | Test giữ chuột giữa đường và thả thật; không chỉ dispatch dragstart |
| Ghost quá to/mờ | URL ghost, kích thước DOM, padding, native drag | Dùng preview URL, bounds hiện tại, opacity 1, draggable=false |
| Váy có sọc thủng ngang | removeNarrowRowFragments và alpha sau lọc | Giữ vùng vải liên tục, đối chiếu source |
| Boot dư chân | Base model đang dùng, stage aspect ratio | Dùng boot base, không chỉ tăng z-index |
| Mũi boot có lỗ | Ngưỡng onlyDark cắt highlight | Giữ highlight sáng của da thuộc, kiểm tra nền tối |
| Váy dài bị cụt | Quy tắc clip runtime và QA | Chỉ tuck jeans; váy nằm trước boot |
| Preview ren bị rách | Có đang dùng sprite làm ảnh tủ không | Giữ preview sản phẩm được duyệt riêng |
| Landing có cột trắng | Nền shell ngoài canvas | Nền mở rộng từ ảnh landing, không phóng méo collage |
