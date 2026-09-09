# Kế hoạch sửa layer áo–quần — 09/09/2026

## Trạng thái thật khi bắt đầu

- Game vẫn dùng `production-v2-20260909-v13-narrow-waistband`.
- Ba ảnh trong `assets/studio/regenerated/2026-09-09-fit-v3/uncut/` chỉ là nguồn thử; chưa được đưa vào game.
- Bản tách denim bằng imagegen đã bị loại vì đổi kích thước/vị trí áo.
- Nguồn áo vàng vừa gen **chưa đạt**: thiếu chỉ đỏ rõ ở cổ và hai nách. Không được dùng nó làm bản cuối.
- Bảy ảnh lỗi người dùng gửi là tiêu chí sửa. Không coi ảnh nhỏ trên desktop hoặc test kích thước PNG là bằng chứng đạt chất lượng.
- Phạm vi hiện tại: lập kế hoạch chi tiết và sửa cách pipeline hoạt động. Các bước sửa hình ảnh dưới đây phải có nguồn, mask và bằng chứng QA trước khi phát hành layer. Không đánh dấu chúng hoàn tất chỉ vì đã viết kế hoạch.

## 1. Khóa product trước mọi thao tác

Giữ nguyên byte của cả bốn PNG hiện có trong `public/game/studio/products/`: hai áo, jeans, boots. Đây là ảnh card và sticker kéo đã được cấp riêng. Không tạo lại, cắt lại, đổi crop/padding, hoặc lấy sprite đang mặc để thay product. `OVERWRITE_PRODUCTS` không còn là đường ghi hợp lệ trong pipeline layer.

Lưu SHA-256 từng product trong `scripts/studio/product-lock.json`. Kiểm tra cả trước và sau mỗi bước. Thiếu ảnh hoặc khác hash thì dừng; không tự tạo ảnh thay thế. Thay product trong tương lai là một yêu cầu riêng của người dùng, không nằm trong công việc này.

## 2. Chốt hợp đồng tọa độ và nguồn

- Canvas mọi layer: 1024 × 1536; x=0, y=0; scale=1; không trim, recenter hoặc resize không đồng đều.
- Khóa vị trí mặt, vai, nách, eo, hông, bàn tay và bàn chân theo model đang chạy, không theo model master cũ trong tài liệu lịch sử.
- Lưu `uncut/`, `masks/`, `layers/`, `qa/`, prompt và manifest cùng một phiên bản. Ảnh chưa cắt được giữ nguyên, kể cả nguồn thử bị loại; ghi lý do loại.
- Mỗi mask phải gắn với hash của chính nguồn đã được kiểm tra. Không tái sử dụng tọa độ khoen hoặc mask cũ cho nguồn mới mà chưa đối chiếu.
- Nguồn neutral và showcase là hai biến thể riêng. Phải giữ thiết kế, đường chỉ và vị trí eo đồng nhất giữa chúng.

## 3. Sửa model nền trước khi chỉnh áo ngoài

**Lỗi:** model hiện tại là ảnh gộp người + bodysuit màu da. Đoạn cổ áo tròn và mép nách đang nằm ngay trong ảnh, không phải CSS hay một layer áo độc lập.

**Cách sửa:** tạo bản model dùng khi mặc áo, phục hồi da tự nhiên ở cổ/ngực trên, vai, nách và phần da nhìn qua các khoen. Giữ nguyên danh tính, dáng, tay/chân và ánh sáng. Giữ model mặc bodysuit cho trạng thái chưa chọn áo. Không xóa alpha toàn thân vì sẽ làm khoen nhìn xuyên nền. Không làm ảnh khỏa thân toàn thân; chỉ phục hồi những vùng da cần nhìn thấy trong bố cục mặc đồ.

Model mặc áo cần biến thể có/không boots và dữ liệu cho từng pose. Chọn bằng một quy tắc dùng chung cho `/play`, showcase, polaroid và `renderLook()` xuất ảnh. Lớp tay phía trước chỉ chứa tay/phụ kiện, không được mang theo viền bodysuit hay mảng hông.

**Đạt khi:** tháo áo vẫn thấy model nền ban đầu; mặc từng áo không còn cổ áo tròn, viền màu beige hay mép vải nền ở nách/sườn, kể cả khi zoom 400%.

## 4. Sửa cấu trúc khoen áo vàng

**Lỗi xác định:** script đang `punchHoles()` cả sprite showcase. Trong khi đó `model-lower` bị cắt từ khoảng y538, nên phần trên khoen lớn không có thân đỡ; jeans lại có thể xuất hiện ở phần dưới.

**Cấu trúc đúng:** vải và vành kim loại có alpha theo đường biên; lòng khoen mở trên lớp áo; phía dưới là da model đủ kín. Không khoét đồng thời da trên sprite người + áo gộp. Không trám lòng khoen bằng một đĩa màu phẳng thiếu bóng.

Với áo vàng mặc ngoài jeans, da phía sau khoen phải nằm trên lớp quần ở đúng vùng lỗ nếu quần đi qua đó. Dùng skin backing đúng pose, có bóng và màu khớp model, clip theo từng khoen với phần chồng nhỏ nằm dưới vành kim loại; backing đi cùng transform áo khi điều chỉnh. Có thể bake backing vào biến thể layer mặc cuối cùng, nhưng giữ garment-only mask riêng trong archive. Ảnh product vẫn giữ lỗ trong suốt như hiện tại.

**Đạt khi:** cả ba khoen hiện da ở neutral/showcase/export, có/không jeans, có/không boots; không lộ nền, denim, bodysuit, đường cắt ngang hay mất vành. Kiểm tra alpha của **ảnh ghép cuối** tại từng lòng khoen bằng 255, không chỉ kiểm tra alpha sprite áo bằng 0.

## 5. Khôi phục thiết kế và cắt áo

### Áo vàng

Nguồn tham chiếu chỉ đỏ: `assets/studio/manual-extraction/production-v2-white/generated/top-modal-red-stitching.png`. Ảnh này còn lỗi áo nền, nên là nguồn thiết kế/đường chỉ, không phải ảnh ghép cuối.

Phải giữ: màu lime, cổ V, hai đường viền đen uốn cong, nếp rút tại khoen lớn, hai khoen nhỏ, chỉ đỏ đứt nét ở **cổ V + cả hai nách + gấu**. Prompt cũ chỉ nói chỉ đỏ/cam ở gấu là thiếu yêu cầu.

Vẽ matte theo viền thực ở độ phóng đại cao, kiểm tra từng đoạn cổ, vai, nách, sườn, nếp gấp, gấu và vành khoen. Giữ nguyên RGB trong phần vải đặc. Không dùng điều kiện màu da để xóa chỉ đỏ, không làm mịn biên bằng median nhiều hàng, không cắt gấu ở một y cố định.

### Áo denim

Giữ cổ đứng, nút bạc, khóa kéo thẳng, chỉ ráp vàng, họa tiết denim, eo và từng sợi tưa ở gấu. Matte bám đúng phần vải, không thêm da/cổ áo nền, không làm gấu thành đường ngang. Không tô bù hàng pixel bằng màu lấy cách xa vài chục pixel.

**Đạt khi:** không mất chi tiết thiết kế so với nguồn; không răng cưa thành bậc, halo trắng, vệt da dính hay lỗ alpha trong vải ở 100%, 200%, 400%.

## 6. Căn áo vàng–jeans thành một phối hợp

**Lỗi xác định:** biến thể jeans hiện bóp 92% đến y646 rồi trở lại 100% ngay dòng kế tiếp; hình học còn dựa trên nguồn khác với áo. Điều này tạo cạnh nhô/chỗ chuyển không liên tục khi thu nhỏ.

Giữ silhouette balloon, túi, cạp, khóa/nút, đường ráp cong và gấu quần. Phục hồi vải bị tay che bằng nguồn riêng rồi đặt tay model lên phía trước. Căn nguồn quần đúng eo/hông, không sửa bằng scaleX CSS.

Denim top sơ vin: áo dưới cạp, quần phủ phần cần sơ vin. Áo vàng mặc ngoài: tạo vùng che của quần theo **đường gấu thực của áo**, có overlap nằm dưới vải đặc để chống khe do lấy mẫu. Không xóa quần theo alpha áo một cách mù quáng: các lỗ khoen phải dùng quy tắc da riêng. Không thu hẹp quần toàn bộ rồi bật lại độ rộng tại một hàng.

**Đạt khi:** hai đầu gấu nối tự nhiên với hông, cạp không nhô cạnh áo, không có đường trắng/beige/xuyên nền ở giữa, không tạo bậc dưới gấu. Xem cả toàn thân nhỏ và cận cảnh; kiểm tra cả neutral và showcase.

## 7. Kiểm tra viền trên mobile và lúc thu nhỏ

Tạo ảnh ghép trên nền trắng, than tối, mint và nền game. Có bản toàn thân ở kích thước hiển thị thực, bản native 1024 × 1536, cùng crop 2×/4× cho cổ, hai nách, hai sườn, ba khoen, gấu áo–cạp quần và khe hai ống quần.

Ma trận tối thiểu:

| Biến thể | Trường hợp |
| --- | --- |
| Áo | denim, vàng |
| Quần/giày | áo riêng; áo + jeans; áo + jeans + boots |
| Pose/đích | neutral, showcase, polaroid, PNG photoshoot |
| Màn hình | desktop 1440×1024; mobile 390×844 và 430×932 |
| Zoom | bình thường; browser pinch zoom 200% và 400% trên mobile |
| Thu nhỏ | toàn thân ở nhiều hệ số lẻ, ví dụ 0.23, 0.31, 0.47 |

Không giảm khả năng zoom hoặc làm mờ layer để giấu lỗi. Phóng cả stage cùng nhau; không fit riêng từng ảnh bằng `object-fit` khác nhau. Bất kỳ viền trắng nhìn thấy, chỉ đỏ bị mất, da sai hoặc khe áo–quần đều là fail, dù test cấu trúc pass.

## 8. Cache và phát hành

Product có version riêng ổn định. Layer version chỉ đổi khi bộ layer đã được kiểm tra và thực sự cài vào runtime. Manifest ghi hash nguồn, mask, layer, variant/pose và bằng chứng QA tương ứng. Không đổi version chỉ để gọi một bản chưa sửa là bản mới.

Đồng bộ version URL layer, preload session key và quy tắc khôi phục fit. Loại fit của asset cũ hoặc fit không có version sau thay hình học; giữ lựa chọn món đồ. Kiểm tra response ảnh đang tải khớp hash bản phát hành, cả reload thường và phiên mới; chỉ dùng hard reload để chẩn đoán, không coi đó là cách sửa cache cho người chơi.

Trước cài đặt: snapshot runtime, chạy kiểm tra product lock, QA bố cục và test chức năng. Chỉ chép các layer đã đạt cùng metadata; không chép toàn thư mục asset/product. Nếu có lỗi phải khôi phục cả layer và version, không để một nửa bản cũ một nửa bản mới.

## Thứ tự thực hiện và đầu ra bắt buộc

Trạng thái sau lượt lập kế hoạch: bước 1 đã có code và kiểm tra; bước 2–7 chưa thực hiện. Chưa có ảnh layer sửa được phát hành. Pipeline build hiện chỉ dựng draft từ nguồn/mask được chuẩn bị riêng; QA ghép/zoom và tích hợp runtime vẫn là các bước làm tiếp theo kế hoạch, không phải tính năng tự động đã có.

1. **Khóa product + viết lại đường chạy pipeline:** hash baseline; build mặc định chỉ xuất draft; chặn lối ghi runtime/product cũ; tài liệu này.
2. **Chốt nguồn model mặc đồ:** cổ/nách là da; backing của ba khoen; neutral và pose. Đầu ra: ảnh chưa cắt + prompt + bằng chứng tọa độ.
3. **Sửa nguồn hai áo và jeans:** giữ đúng thiết kế, đặc biệt chỉ đỏ. Đầu ra: nguồn chưa cắt được chọn, ghi rõ nguồn loại.
4. **Cắt matte theo từng nguồn:** garment alpha, skin backing, tay, occlusion áo–quần. Đầu ra: mask chỉnh sửa được và layer draft 1024×1536.
5. **QA phối chéo/zoom:** ảnh nền sáng/tối, crop, mobile, showcase và export. Đầu ra: báo cáo pass/fail từng mục với đường dẫn ảnh.
6. **Tích hợp layer + cache:** cùng quy tắc trên màn hình và export, giữ hash product. Đầu ra: runtime manifest và tests.
7. **Bàn giao:** nói rõ đã gen/cắt/tích hợp những gì, còn lỗi gì; liên kết ảnh trước/sau, archive chưa cắt và version thực tế. Không báo “đã sửa” khi chỉ có ảnh nguồn.

## Tiêu chí hoàn tất

- [x] Product giữ nguyên 4/4 hash ở lượt lập kế hoạch/pipeline; kiểm tra lại khi phát hành layer.
- [ ] Khoen hiện da tự nhiên trên mọi pose và bản xuất.
- [ ] Mặc áo không thấy bodysuit nền ở cổ/nách/sườn.
- [ ] Áo vàng–quần khớp gấu, không bậc/cạp nhô/khe trắng.
- [ ] Giữ đủ chỉ đỏ tại cổ, hai nách và gấu; đủ vành khoen và sợi tưa denim.
- [ ] Không halo trắng/da dính/răng cưa ở mobile zoom 400% và khi thu nhỏ.
- [ ] Layer mới được tải đúng version, fit cũ không làm lệch.
- [ ] Có archive chưa cắt, mask theo nguồn, QA và kiểm tra chức năng đạt.
