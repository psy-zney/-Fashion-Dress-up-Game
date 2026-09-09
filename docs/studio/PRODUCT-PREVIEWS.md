# Product: ảnh tủ đồ và sticker kéo

Quy định người dùng ngày 09/09/2026: giữ nguyên bốn PNG đang có trong `public/game/studio/products/` (hai áo, jeans, boots). Đây là artwork được cấp riêng. Công việc sửa layer mặc lên model không được thay chúng bằng ảnh cắt từ model.

- Card và drag cùng dùng `previewAssetUrl()`; version product độc lập với version layer.
- Không sửa crop, padding, kích thước, màu, alpha hay đường dẫn ảnh product trong pipeline layer.
- `scripts/studio/product-lock.json` lưu SHA-256 từng ảnh. `npm.cmd run studio:audit` kiểm tra cả danh sách và nội dung.
- Script tạo product cũ đã bị chặn. Không tự phục hồi ảnh thiếu, không cập nhật lock để che một thay đổi ngoài yêu cầu.
- Lỗ khoen trong product được giữ theo artwork hiện có. Quy tắc khoen hiện da áp dụng cho layer mặc/ảnh ghép trên model, không phải product.

Quy trình đang dùng: [PIPELINE.md](PIPELINE.md). Kế hoạch sửa bảy lỗi: [REPAIR-PLAN-2026-09-09.md](REPAIR-PLAN-2026-09-09.md).
