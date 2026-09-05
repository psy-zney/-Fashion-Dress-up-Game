# Ảnh sản phẩm và sticker kéo

## Đường dẫn active

`previewAssetUrl(id)` trong `src/lib/studio.ts` trả `/game/studio/products-v2/<id>.png` cho **toàn bộ 14 món**. Card và ghost dùng chung hàm này. `assetUrl(id)` của model không thay đổi.

Nguồn ở `public/studio-v2/generated/` được giữ nguyên. Ba áo trắng/kem cột trái đã có alpha thật. Các áo cột phải và sáu bottom có nền caro in vào RGB; CSS opacity=1 hoặc draggable=false không thể loại nền này. Mary Jane cũ dùng sprite đã lọc màu da nên quai bị rời, không đủ hình sản phẩm.

## Tạo lại

```powershell
npm.cmd run prepare:products
```

Cấu hình: `scripts/studio/product-preview.config.mjs`. Script: `scripts/studio/prepare-product-previews.mjs`. Chỉ ghi thư mục products-v2 và QA products; không ghi layer mặc/model hay ảnh gốc. Không chạy prepare:studio để sửa ảnh tủ.

Các chế độ:

- `alpha`: giữ kênh alpha đã có, không lọc lại ren hay màu vải. Dùng cho ba áo cột trái và preview boot.
- `exterior`: flood-fill từ ngoài, loại nền sáng trung tính nối thông với ngoài. Chấm bi/highlight sáng bên trong được bao bởi vải tối nên giữ lại. Dùng cho ba áo cột phải, bốn bottom tối và Mary Jane.
- `silhouette`: mask đường viền đã đối chiếu trên nguồn 1024×1536, dùng riêng short trắng và váy xếp ly trắng. Giữ nguyên pixel vải bên trong. Không dùng ngưỡng màu trắng toàn ảnh vì sẽ làm thủng vải. Khi đổi nguồn phải duyệt/căn mask lại, không tái sử dụng outline một cách mù quáng.

Mary Jane dùng nguồn mới `assets/studio/source/product-edits/shoes-mary-janes-v2.png`, tạo bằng Imagegen để có đôi giày đầy đủ, lòng giày và quai liên tục, không có chân người. Prompt chính xác được giữ cạnh ảnh. Kết quả gen vẫn có nền caro in vào ảnh nên cần bước exterior; không coi hình caro nhìn thấy là bằng chứng của alpha thật.

Sau các chế độ trên, xoá alpha của dải bảo vệ 4px sát mép canvas để loại vài pixel rác ở góc ảnh xuất. Silhouette của 14 nguồn hiện tại đều nằm xa mép; nguồn mới phải được kiểm tra điều kiện này trước khi dùng. Không cắt hay thu nhỏ canvas.

## Kiểm tra trước khi dùng

Script kiểm tra ít nhất 20% pixel trong suốt, ghi SHA-256 nguồn, kích thước và tỷ lệ alpha vào `artifacts/studio-qa/products/report.json`. Contact sheet nền mint ở cùng thư mục giúp phát hiện khung trắng và vải bị khoét.

Chạy `npm.cmd run test:e2e`: test asset kiểm tra đủ 14 PNG, có alpha thật, viền 4px ngoài hoàn toàn trong suốt. Test kéo thử áo đen cột phải, jeans cột trái, short trắng cột phải, váy navy và Mary Jane; kiểm tra cùng URL, cùng kích thước DOM, opacity=1, thả vào stage mặc được. Screenshot giữ chuột nằm ở `artifacts/studio-qa/products/drag-<id>.png`.

Không trim/resize riêng ghost: kích thước và padding lấy từ ảnh DOM khi nhấn. Không thêm nền vào `.garment-drag-preview`. Các nguồn quần áo giữ nguyên canvas/framing để không thay kích thước tương đối đã được duyệt; Mary Jane có bố cục sản phẩm riêng.

Chỉ cập nhật `products-v2` sau khi xem contact sheet và ảnh kéo trên nền mint. Để phục hồi, chọn lại nguồn/cấu hình cũ; không xoá ảnh gốc hoặc cache gen. Ảnh source và outline của bản này được lưu cùng project nên lần sau không cần dựng lại từ đầu.
