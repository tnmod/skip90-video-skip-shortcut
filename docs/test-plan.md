# Kế hoạch kiểm thử và nghiệm thu

Chạy trên Google Chrome thật với Skip90 được nạp unpacked. Các fixture chạy trên loopback và dùng media đi kèm. Dùng hai origin để xác minh điều phối qua iframe khác nguồn. Với seek, kiểm tra `currentTime`, trạng thái playback, số sự kiện `seeked` và overlay. Với fullscreen, kiểm tra cả loại phần tử fullscreen và hình ảnh trình duyệt đã vẽ.

## Chạy lại

Từ thư mục repo, dùng Node.js 22 trở lên và Google Chrome cài sẵn.

```sh
node --test tests/media.test.mjs tests/background.test.mjs
node tests/browser.mjs
```

Bộ test trình duyệt dùng Playwright. Có thể đặt `SKIP90_PLAYWRIGHT` thành đường dẫn tới package Playwright có sẵn và `SKIP90_ARTIFACTS` thành thư mục lưu ảnh kiểm thử. `SKIP90_HEADED=1` mở cửa sổ Chrome trong profile kiểm thử riêng. Để thử fixture thủ công, chạy `node tests/serve.mjs` và mở `http://127.0.0.1:4173`.

## Nghiệm thu

Ngày 13/11/2026, Skip90 0.3.0 đạt **23/23** ca trên Google Chrome `157.0.8103.78` và **28/28** ca Node.js.

| Nhóm | Kiểm tra | Kết quả |
| --- | --- | --- |
| Cấu hình | S/90 khi cài lần đầu, nhập 1:40, từ chối giây 60, tổng 0 và dòng chưa có phím, đổi sang A và tắt trên tab đang mở | Passed |
| Danh sách phím | A → 10 giây, B → 20 giây, C → 30 giây tua đúng từng mức. Từ chối phím trùng, ngừng bắt phím đã xóa và lưu được danh sách rỗng. Cấu hình một phím của 0.1.0 vẫn đọc và hoạt động trước khi lưu sang dạng danh sách. | Passed |
| Lưu bền vững | Lưu S → 120 giây và A → 10 giây, đóng và mở lại Chrome cùng profile rồi nạp lại cùng tiện ích qua DevTools. Cả hai dòng vẫn có trong `storage.local` và popup. | Passed |
| Seek | 60, 90 và 100 giây, gần cuối chỉ tua 40 giây, giữ pause/play và tốc độ phát, MediaSource DVR có duration vô hạn | Passed |
| Seek không hợp lệ | Video ẩn, thiếu metadata và không có range, phần tử bị thay thế lúc discovery, nguồn video đổi khi đang seeking. Không có overlay thành công. | Passed |
| Khoảng seek rời | Đích nằm trong khoảng trống, nhảy vào range sau, không có điểm tiến và các biên của live DVR trong kiểm thử thuật toán thuần | Passed |
| Điều phối | Main frame, iframe cùng nguồn, iframe khác nguồn và `srcdoc`. Nhiều video đang phát, click controls đè lên video, nhấn dồn, iframe khác nguồn ẩn hoặc ngoài viewport. | Passed |
| Timeout và xác thực | Báo cáo thiếu, trễ, sai tab, trùng hoặc thuộc tài liệu thay thế. Khóa được giải phóng sau timeout mà không gửi seek sang ứng viên thứ hai. Kiểm tra bằng Chrome API mô phỏng trong Node. | Passed |
| Bàn phím | Input, textarea, select, contenteditable, role textbox, shadow root mở và đóng, phím bổ trợ và phím lặp. Chrome DevTools mô phỏng composition và mã IME 229. | Passed |
| Popup | Chrome mở popup toolbar thật. Đã kiểm tra layout 320 px, gán phím, validation, phản hồi lưu, focus, không tràn ngang và tài nguyên cục bộ. | Passed |
| Overlay | Hiển thị **NEXT +1:30** ở nửa phải video, hiển thị số giây thực tế khi tua gần cuối, di chuyển theo video, cho sự kiện chuột đi qua và tự biến mất. Đã kiểm tra nội dung, tọa độ và pixel đã render. | Passed |
| Fullscreen | Ưu tiên container fullscreen trong iframe khác nguồn và hiển thị overlay khi chính video fullscreen. Cả hai ca kiểm tra nội dung, tọa độ và pixel đã render. | Passed |
| Môi trường bổ sung | Website streaming bên ngoài, IME thật của hệ điều hành, trình đọc màn hình, Chrome 119 và quy trình khởi động lại sau khi chọn thư mục qua hộp thoại Load unpacked | Not Tested |

Chrome gỡ đăng ký bản unpacked do DevTools cài khi khởi động lại. Ca lưu bền vững nạp lại cùng đường dẫn trong cùng profile để kiểm tra dữ liệu trên đĩa. [Mã nguồn Chromium về bản cài qua DevTools](https://github.com/chromium/chromium/blob/main/extensions/browser/extension_prefs.cc#L2686).
