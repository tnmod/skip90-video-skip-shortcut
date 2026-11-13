# Skip90

Skip90 tua tiến video HTML5 bằng các phím tùy chỉnh. Mỗi phím có một thời lượng riêng. Mặc định, phím **S** tua **90 giây**. Tiện ích chọn một video ưu tiên trong tab và hiển thị thời lượng thực tế đã tua. Cài đặt được lưu cục bộ trong Chrome.

## Cài đặt

1. Dùng Google Chrome 119 trở lên. Tải và giải nén [Skip90-0.3.0.zip](dist/Skip90-0.3.0.zip) hoặc dùng trực tiếp thư mục repo.
2. Mở `chrome://extensions` và bật **Developer mode**.
3. Chọn **Load unpacked**, rồi chọn thư mục chứa `manifest.json`.
4. Tải lại các trang video đã mở trước khi cài. Có thể ghim Skip90 vào thanh công cụ để mở popup nhanh.

[Hướng dẫn Load unpacked của Chrome](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked)

Khi nâng cấp bản unpacked, cập nhật file trong thư mục đã nạp, bấm **Reload** trên thẻ Skip90 ở `chrome://extensions` rồi tải lại các trang video đang mở. Dùng lại cùng thư mục để Chrome giữ cấu hình của bản cũ.

## Sử dụng

- Mở một trang có video HTML5, đặt focus trên trang và nhấn **S**. Khi gần cuối, Skip90 tua đến điểm hợp lệ xa nhất trong thời lượng đã chọn.
- Sau khi tua thành công, nửa phải của video hiện **NEXT** và thời lượng thực tế, ví dụ **+1:30**. Overlay tự biến mất và vẫn cho phép bấm các nút của trình phát.
- Mở popup Skip90 và chọn **Add shortcut**. Nhập phút và giây trên từng dòng. Phút là số nguyên từ 0 trở lên, giây từ 0 đến 59 và tổng ít nhất 1 giây.
- Bấm **Set key**, rồi nhấn một chữ cái từ **A** đến **Z**. Ví dụ, tạo ba dòng cho **A → 10 giây**, **B → 20 giây** và **C → 30 giây**. Mỗi phím chỉ dùng cho một dòng.
- Bấm phím đang hiển thị để gán lại hoặc bấm **×** để xóa dòng. Chọn **Save settings** để áp dụng ngay trên các tab đã nạp Skip90.
- Dùng công tắc **Enable shortcuts** rồi bấm **Save settings** để bật hoặc tắt cả danh sách. Cấu hình một phím từ 0.1.0 xuất hiện thành một dòng sau khi nâng cấp.

## Xử lý sự cố

- Nếu phím tắt không phản hồi, kiểm tra trạng thái **Shortcuts on**, chữ cái đã lưu, quyền truy cập trang của tiện ích và focus của tab. Skip90 bỏ qua phím khi đang nhập liệu, dùng IME, giữ phím hoặc kèm phím bổ trợ.
- Nếu website cũng dùng chữ cái đó, chọn một chữ cái khác. Skip90 giữ luồng sự kiện cho website, vì vậy shortcut riêng của website vẫn có thể phản hồi.
- Nếu có nhiều video, bấm vào video hoặc controls của trình phát cần tua rồi nhấn phím. Video fullscreen đủ điều kiện được ưu tiên trước.
- Nếu video chưa sẵn sàng, không còn điểm seek phía trước hoặc trình phát chặn seek, Skip90 bỏ qua thao tác và không hiện overlay thành công.

## Phạm vi và quyền riêng tư

Skip90 xử lý video HTML5 trong các trang và iframe HTTP/HTTPS mà Chrome cho phép tiện ích truy cập. Trang nội bộ Chrome, Chrome Web Store và các frame bị chặn bởi chính sách trình duyệt nằm ngoài phạm vi. Hỗ trợ video live phụ thuộc vào vùng DVR mà trình phát cung cấp. Các website streaming cụ thể có thể dùng logic phím tắt hoặc cơ chế phát riêng.

Quyền `storage` lưu trạng thái bật/tắt và danh sách phím cùng thời lượng. Phạm vi truy cập HTTP/HTTPS giúp nhận phím, tìm video và tua trong các frame đủ điều kiện, kể cả iframe khác nguồn. Skip90 không gửi dữ liệu ra máy chủ hoặc lưu lịch sử xem.

## Tài liệu

- [Kiến trúc và message protocol](docs/architecture.md)
- [Kế hoạch và kết quả kiểm thử](docs/test-plan.md)
- [Ghi chú triển khai](docs/implementation-notes.md)
- [Nội dung và tài nguyên Chrome Web Store](CHROMEWEBSTORE.md)
