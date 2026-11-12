# Skip90 – Video Skip Shortcut

## Mục tiêu

Xây dựng tiện ích Chrome Manifest V3 để tua qua intro, outro và các đoạn video theo thời lượng người xem chọn. Ví dụ, nhấn `S` khi video đang ở `03:20` sẽ tua tới `04:50` với cấu hình mặc định 90 giây. Intro và outro dùng chung thao tác tua tiến khi người xem bấm phím.

## Phạm vi bản đầu

- Phím tắt mặc định là `S`. Người dùng có thể đổi sang một phím chữ khác khi trùng với phím của website.
- Thời lượng mặc định là 90 giây. Popup có ô phút và giây, các mốc chọn nhanh `1:00`, `1:30`, `1:40`, `2:00`, nút Lưu và công tắc bật/tắt.
- Lưu trạng thái bật/tắt, thời lượng và phím tắt trong `chrome.storage.local`. Tab đang mở áp dụng cấu hình mới sau khi lưu.
- Tua video HTML5 có hỗ trợ seek, kể cả trong iframe được cấp quyền và ở chế độ toàn màn hình. Hiện thông báo ngắn như `+1:30` sau khi tua thành công. Nếu chỉ tua được một phần do gần cuối video, hiển thị thời lượng thực tế.
- Popup rộng khoảng 320 px, dùng Inter nếu có sẵn cục bộ và font hệ thống làm dự phòng. Hiển thị rõ cấu hình hiện tại và phản hồi khi lưu.

## Cấu trúc dự án

Dùng JavaScript, HTML và CSS. Có thể nạp trực tiếp mã nguồn bằng Load unpacked.

| Tệp | Trách nhiệm |
| --- | --- |
| `manifest.json` | Khai báo Manifest V3, tên tiện ích, popup, icon, quyền storage, service worker và content script cho trang HTTP/HTTPS. |
| `background.js` | Điều phối yêu cầu trong tab phát sinh phím tắt, chọn một frame và gửi lệnh tua tới frame đó. |
| `content.js` | Nhận phím, tìm video có thể tua, gửi thông tin ứng viên, áp dụng lệnh tua và hiện thông báo. |
| `overlay.css` | Định dạng thông báo tua trên video. |
| `popup.html`, `popup.css`, `popup.js` | Hiển thị và lưu cấu hình. Kiểm tra số phút và giây là số nguyên, phần giây từ 0 đến 59 và tổng thời lượng lớn hơn 0. |
| `icons/` | Logo gốc và các icon PNG đã xuất cho Chrome. |

Content script bắt phím đơn qua sự kiện `keydown` trong trang và trong các frame phù hợp với `all_frames`. Phạm vi HTTP/HTTPS cho phép dùng phím ngay trên các trang xem video và các trình phát nhúng khác nguồn. Cấu hình và thao tác tua xử lý cục bộ.

## Quy tắc chọn và tua video

1. Bỏ qua sự kiện khi tiện ích đang tắt, đang gõ trong ô nhập hoặc vùng soạn thảo, đang dùng bộ gõ, có phím bổ trợ hoặc đang giữ phím khiến sự kiện lặp.
2. Ưu tiên video đang toàn màn hình, sau đó tới video người dùng vừa tương tác, rồi video đang phát và hiển thị lớn nhất. Chọn ứng viên trên toàn tab trước khi tua để mỗi lần bấm chỉ tác động tới một video.
3. Tính đích từ thời điểm hiện tại cộng với thời lượng đã chọn, rồi giới hạn theo thời lượng video và các khoảng có thể tua. Dùng `currentTime` để tua và giữ trạng thái phát hoặc tạm dừng trong khả năng của trình phát.
4. Chỉ hiện thông báo sau khi có thao tác tua thành công. Nếu video chưa tải metadata hoặc chưa có khoảng tua phù hợp, bỏ qua lần bấm.
5. Tìm video tại thời điểm thao tác để hỗ trợ trang chuyển tập hoặc thay trình phát mà không tải lại trang.

## Logo và icon

- Dùng hai tam giác trắng hướng sang phải trên ô vuông tím chàm bo góc. Giữ hình khối đơn giản và kiểm tra khả năng nhận diện ở 16 px.
- Dùng biểu tượng riêng cho thanh công cụ. Đặt chữ **Skip90** cạnh biểu tượng trong popup và hình giới thiệu trên Store.
- Lưu bản gốc có thể chỉnh sửa và xuất PNG vuông `icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png`. Kiểm tra trên nền sáng và tối.

## Thứ tự triển khai và nghiệm thu

1. Dựng popup và logo theo thiết kế trên.
2. Cài đặt lưu cấu hình và tua video HTML5 trong trang chính. Xác nhận `03:20` thành `04:50` ở mốc 90 giây và `05:00` ở mốc 100 giây.
3. Hoàn thiện điều phối iframe và kiểm tra toàn màn hình, nhiều video, chuyển tập, video tạm dừng và trường hợp sát cuối clip.
4. Kiểm tra phím tắt khi gõ, dùng bộ gõ, giữ phím, đổi phím và bật/tắt. Đóng mở lại Chrome để xác nhận cấu hình được giữ.
5. Nạp bằng Load unpacked trên Chrome. Dùng video HTML5 và iframe mẫu để kiểm tra ban đầu, sau đó thử trên trang anime người dùng chọn khi có URL.
6. Chuẩn bị gói cài thử, hướng dẫn sử dụng và nội dung Chrome Web Store gồm tên, mô tả ngắn, icon 128 px và ảnh chụp popup.

## Tham khảo

- [Định dạng Chrome Manifest](https://developer.chrome.com/docs/extensions/reference/manifest)
- [Content script và cấu hình iframe](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts)
- [Icon tiện ích Chrome](https://developer.chrome.com/docs/extensions/reference/manifest/icons)
