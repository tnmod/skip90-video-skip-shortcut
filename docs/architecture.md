# Kiến trúc Skip90

Skip90 là tiện ích Chrome Manifest V3 dùng JavaScript thuần. Popup, service worker và content script đọc cấu hình `{ enabled, shortcuts: [{ shortcutKey, skipSeconds }] }` từ `chrome.storage.local`. Mỗi chữ cái A–Z xuất hiện tối đa một lần. `config.js` đọc cấu hình một phím của bản cũ khi danh sách chưa tồn tại. Popup ghi toàn bộ danh sách và trạng thái bật/tắt trong một lần lưu. Mỗi content script theo dõi `storage.onChanged` để nhận cấu hình mới trong tài liệu đang mở.

## Quyền và phạm vi

- `storage` lưu trạng thái bật/tắt và danh sách phím cùng thời lượng trên thiết bị.
- Content script được khai báo cho `http://*/*` và `https://*/*` với `all_frames`. Chrome xét quyền và URL của từng frame, kể cả iframe khác nguồn. `match_origin_as_fallback` cho phép Chrome xét origin đã tạo frame liên quan có URL như `about:blank`, `about:srcdoc` hoặc `blob:`.
- `chrome.tabs.sendMessage()` dùng ID tab do Chrome cung cấp và có thể gửi đến một `documentId` cụ thể. Luồng này không cần quyền `tabs`, `webNavigation`, `scripting` hay `host_permissions` bổ sung.
- Tiện ích hoạt động trong isolated world. Trang web không thể gửi lệnh qua `window.postMessage`. Tiện ích không lưu lịch sử video hoặc truyền dữ liệu ra mạng.

## Điều phối một lần nhấn

| Message | Hướng | Dữ liệu và xử lý |
| --- | --- | --- |
| `SKIP_REQUEST` | Frame nhận phím → worker | Gửi `shortcutKey`. Worker tạo `requestId`, khóa theo tab và đọc cấu hình hiện tại. |
| `DISCOVER_VIDEOS` | Worker → các frame trong tab | Gửi `requestId`, `shortcutKey`, `skipSeconds`, `deadline`. Các frame không trả lời trực tiếp broadcast. |
| `VIDEO_CANDIDATES` | Từng frame → worker | Gửi `requestId`, danh sách riêng, `framePath` và `hiddenChildIndexes`. Worker xác thực `sender.id`, tab, `frameId` và `documentId`. |
| `EXECUTE_SEEK` | Worker → tài liệu thắng | Gửi `requestId`, `candidateId`, `shortcutKey`, `skipSeconds`, `deadline`. Địa chỉ đích là `documentId` đã báo ứng viên. |
| `SEEK_RESULT` | Tài liệu thắng → worker | Phản hồi trực tiếp gồm `requestId`, `ok` và `skippedSeconds` hoặc `reason`. Worker chuyển thành công về frame nhận phím. |
| `SKIP_FAILED` | Worker → frame nhận phím | Trả `requestId` và `reason` khi không thể xác nhận thành công. |

Mỗi báo cáo ứng viên gồm `candidateId`, `isFullscreen`, `lastInteractionAt`, `isPlaying`, `isPaused`, `isVisible`, `visibleArea`, `currentTime`, `duration`, `seekableRanges` và `readyState`. `duration: null` biểu diễn live có thời lượng vô hạn vì Chrome dùng JSON cho message. Báo cáo dùng các cặp `[start, end]` cho seekable ranges và timestamp epoch mili giây cho tương tác.

Worker thu báo cáo trong một cửa sổ ngắn, yêu cầu tài liệu phát sinh phím vẫn báo lại, rồi chọn theo thứ tự fullscreen, tương tác trong 20 giây qua, đang phát và diện tích nhìn thấy. Frame dùng `IntersectionObserver` để đo phần video giao với viewport qua các frame. Tài liệu cha kiểm tra CSS của thẻ iframe và báo các nhánh con bị ẩn hoặc nằm ngoài fullscreen. Worker đối chiếu các nhánh đó bằng đường dẫn chỉ số `WindowProxy` mà Chrome cho phép đọc qua origin. Đường dẫn dùng để lọc hiển thị, còn lệnh tua luôn định tuyến bằng `documentId` của Chrome. Tương tác chuột có thể đến từ controls đè lên video hoặc controls liền kề. Khi hòa, thứ tự frame và ứng viên tạo kết quả ổn định.

Worker kiểm tra lại cấu hình trước khi gửi một lệnh seek duy nhất. Lệnh có deadline tuyệt đối và bản ghi ứng viên được tiêu thụ trước khi thực thi. Worker giải phóng khóa sau kết quả hoặc timeout. Một lệnh có kết quả không rõ ràng không được gửi lại sang video khác vì phép gán có thể đã xảy ra. Khi worker bị dừng, dữ liệu điều phối hết hiệu lực và thao tác mới đọc lại cấu hình từ storage.

## Seek và thông báo

`media.js` chọn điểm tiến xa nhất trong các khoảng seekable mà không vượt `currentTime + skipSeconds` hoặc duration hữu hạn. `content.js` kiểm tra lại phần tử, nguồn video và khoảng seek trước khi gán `currentTime`. Video vừa bị thay thế, đang tua hoặc không còn điểm tiến hợp lệ bị bỏ qua. `seeked` từ trình duyệt, giá trị `currentTime` và deadline quyết định kết quả. Việc gán thời gian giữ nguyên lựa chọn phát, tạm dừng và tốc độ phát của trình phát.

Overlay dùng manual popover để hiển thị trên video, kể cả khi chính `<video>` toàn màn hình. Nó bám theo khung của video trong viewport của frame trong khoảng 1,25 giây. Shadow DOM chứa lớp phủ nhẹ, nhãn **NEXT** và thời lượng thực tế ở bên phải. Overlay cho các thao tác chuột đi qua và chỉ dùng hiệu ứng mờ khi người dùng cho phép chuyển động.

## Tài liệu API

- [Khai báo content script và frame liên quan](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts#injecting-in-related-frames)
- [Chrome message passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging) và [gửi đến documentId](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-sendMessage)
- [Vòng đời extension service worker](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Tính giao của IntersectionObserver qua các browsing context](https://www.w3.org/TR/intersection-observer/#compute-the-intersection)
- [Truy cập theo chỉ số của WindowProxy](https://html.spec.whatwg.org/multipage/nav-history-apis.html#indexed-access-on-the-window-object)
- [HTMLMediaElement seeking](https://html.spec.whatwg.org/multipage/media.html#seeking), [Fullscreen API](https://fullscreen.spec.whatwg.org/) và [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API)
