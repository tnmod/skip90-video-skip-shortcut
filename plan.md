# Skip90 — Video Skip Shortcut

**Project Specification & Agent Implementation Instructions**

## 1. Vai trò và mục tiêu

Bạn là Senior Chrome Extension Engineer kiêm UI/UX Designer, chịu trách nhiệm thiết kế kiến trúc, triển khai và kiểm thử sản phẩm Skip90.

Xây dựng một tiện ích Google Chrome sử dụng Manifest V3, cho phép người dùng tua nhanh video HTML5 bằng phím tắt tùy chỉnh.

Mục tiêu sản phẩm:

- Giao diện popup nhỏ gọn, hiện đại, chuyên nghiệp.
- Tương thích với các trình phát video HTML5 trên nhiều website.
- Hỗ trợ video nằm trong iframe, bao gồm iframe khác nguồn khi Chrome cho phép inject content script.
- Mỗi lần nhấn phím chỉ tác động đến một video được ưu tiên trên toàn tab.
- Xử lý chính xác các trường hợp video đang phát, tạm dừng, toàn màn hình, chuyển tập và gần cuối video.
- Hoạt động hoàn toàn cục bộ, không cần server hoặc dịch vụ bên ngoài.

**Nguyên tắc bắt buộc:**

- Không thay đổi phạm vi chức năng đã xác định.
- Không thêm tính năng ngoài yêu cầu nếu chưa thực sự cần thiết.
- Không đưa thêm framework hoặc dependency chỉ để giải quyết vấn đề đơn giản.
- Không đánh đổi độ ổn định để lấy sự đơn giản giả tạo.
- Ưu tiên API chính thức của Chrome và Web Platform.
- Không tuyên bố một chức năng đã hoàn thành nếu chưa kiểm chứng.

---

## 2. Agent Skills — Quy trình sử dụng

Trước khi thiết kế hoặc viết code, kiểm tra các Agent Skills hiện có trong môi trường của agent.

Tìm và đọc nội dung `SKILL.md` của các skill liên quan. Không giả định một skill đã được cài đặt chỉ vì tên của nó xuất hiện trong tài liệu.

### Nhóm UI/UX

Ưu tiên sử dụng:

- UI UX Pro Max: Lựa chọn UI style, design system, typography, color palette và UX guidelines.
- Frontend Design: Thiết kế giao diện có tính thẩm mỹ và nhận diện sản phẩm riêng.
- Frontend UI Engineering: Tổ chức và triển khai giao diện.

### Nhóm Chrome Extension

Ưu tiên tìm các skill liên quan đến:

- Chrome Extensions.
- Chrome Manifest V3.
- Chrome Extension APIs.
- Service Worker.
- Content Scripts và Cross-frame Messaging.
- Browser Permissions và Extension Security.

### Nhóm Testing

Ưu tiên:

- Webapp Testing.
- Agent Browser.
- Browser Automation.
- JavaScript Testing.

### Quy tắc sử dụng skill

1. Đọc nội dung skill trước khi áp dụng.
2. Chỉ sử dụng skill liên quan trực tiếp đến công việc hiện tại.
3. UI UX Pro Max phải được sử dụng trong giai đoạn nghiên cứu thiết kế.
4. Frontend Design phải được sử dụng trong giai đoạn triển khai popup và logo.
5. Các skill Chrome Extension phải được dùng để kiểm tra kiến trúc và API.
6. Các skill Testing phải được dùng khi xây dựng và thực hiện test plan.
7. Nếu một skill chưa được cài đặt, tiếp tục bằng tài liệu kỹ thuật chính thức, không tự bịa nội dung hoặc coi skill đó đã được sử dụng.
8. Không cài thêm dependency hoặc skill mới nếu chưa có lý do kỹ thuật rõ ràng.

Skill là nguồn hướng dẫn bổ trợ, không thay thế tài liệu chính thức hoặc khả năng đánh giá kỹ thuật của agent.

---

## 3. Tech Stack và giới hạn kỹ thuật

| Thành phần | Công nghệ |
|---|---|
| Browser | Google Chrome |
| Extension | Manifest V3 |
| Programming Language | Vanilla JavaScript |
| Markup | HTML5 |
| Styling | CSS3 |
| Storage | chrome.storage.local |
| Background | Extension Service Worker |
| Page Interaction | Content Scripts |
| Video API | HTMLMediaElement |
| UI Font | Inter + System Font Fallback |
| Testing | Browser Testing + JavaScript Tests |

### Không sử dụng

- React, Vue, Angular.
- Next.js hoặc các framework frontend.
- Tailwind CSS.
- jQuery.
- Backend server.
- Database bên ngoài.
- Remote scripts hoặc remote fonts.
- Thư viện lớn cho những chức năng có thể xử lý trực tiếp bằng Web API.

Có thể sử dụng công cụ kiểm thử hoặc công cụ phát triển nếu thực sự cần thiết, nhưng sản phẩm cuối cùng phải nạp trực tiếp bằng Chrome Load unpacked mà không cần chạy dev server.

---

## 4. Phạm vi chức năng MVP

### 4.1. Phím tắt

- Mặc định: `S`.
- Người dùng có thể đổi sang một phím chữ cái khác từ A đến Z.
- Phím tắt hoạt động trên trang đang phát video.
- Cùng một thao tác tua tiến được dùng cho cả intro, outro và các đoạn video người dùng muốn bỏ qua.
- Không có tính năng tự động nhận diện intro hoặc outro trong MVP.

Ví dụ:

| Thời điểm hiện tại | Cấu hình | Kết quả |
|---|---:|---|
| 03:20 | 60 giây | 04:20 |
| 03:20 | 90 giây | 04:50 |
| 03:20 | 100 giây | 05:00 |
| 03:20 | 120 giây | 05:20 |

### 4.2. Popup

Kích thước mục tiêu: khoảng 320 px chiều rộng.

Các thành phần:

- Logo và tên Skip90.
- Công tắc bật/tắt tiện ích.
- Ô nhập phút.
- Ô nhập giây.
- Các preset:
  - 1:00
  - 1:30
  - 1:40
  - 2:00
- Cấu hình phím tắt.
- Nút Lưu.
- Trạng thái hiện tại.
- Phản hồi thành công hoặc lỗi khi lưu.

### 4.3. Validation

- Phút phải là số nguyên không âm.
- Giây phải là số nguyên từ 0 đến 59.
- Tổng thời lượng phải lớn hơn 0.
- Phím tắt phải là một chữ cái A-Z.
- Không cho phép lưu dữ liệu không hợp lệ.
- Không tự động sửa dữ liệu sai theo cách khiến người dùng không biết.

### 4.4. Storage

Sử dụng `chrome.storage.local`.

Cấu hình mặc định:

```json
{
  "enabled": true,
  "skipSeconds": 90,
  "shortcutKey": "S"
}
```

Yêu cầu:

- Tạo cấu hình mặc định khi cài đặt lần đầu.
- Lưu toàn bộ cấu hình khi nhấn Lưu.
- Giữ dữ liệu khi đóng và mở lại Chrome.
- Popup phải hiển thị cấu hình đã lưu.
- Các tab đang mở phải nhận cấu hình mới ngay sau khi lưu.
- Không yêu cầu reload trang.
- Các frame phải đồng bộ trạng thái bật/tắt và thời lượng.

---

## 5. Kiến trúc hệ thống

Trước khi triển khai, phải thiết kế kiến trúc và xác định rõ trách nhiệm của từng module.

Cấu trúc mục tiêu:

```text
Skip90/
├── manifest.json
├── background.js
├── content.js
├── overlay.css
│
├── popup.html
├── popup.css
├── popup.js
│
├── icons/
│   ├── logo.svg
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   └── icon-128.png
│
├── tests/
│   ├── fixtures/
│   └── test-plan.md
│
├── docs/
│   ├── architecture.md
│   └── implementation-notes.md
│
└── README.md
```

Có thể bổ sung file hoặc thư mục khi có lý do kỹ thuật rõ ràng, nhưng không tạo cấu trúc phức tạp không cần thiết.

### 5.1. manifest.json

Khai báo:

- Manifest Version 3.
- Extension name và description.
- Popup.
- Extension icons.
- Permissions tối thiểu.
- Background service worker.
- Content scripts cho HTTP và HTTPS.
- `all_frames: true`.

Cần đánh giá:

- Host permissions và mức truy cập website cần thiết.
- Khả năng inject content script vào iframe khác nguồn.
- `match_about_blank` và `match_origin_as_fallback` khi cần hỗ trợ frame có URL đặc biệt.
- Giới hạn của các trang Chrome không cho phép extension inject.

Không được giả định `all_frames: true` bảo đảm inject thành công vào mọi iframe. Mỗi frame vẫn phải thỏa mãn điều kiện URL và quyền truy cập tương ứng.

Không yêu cầu quyền `webNavigation`, `tabs` hoặc quyền khác nếu kiến trúc thực tế không cần chúng.

### 5.2. background.js

Đây là Extension Service Worker, chịu trách nhiệm điều phối toàn bộ thao tác tua trong một tab.

Các nhiệm vụ:

- Nhận yêu cầu từ content script.
- Kiểm tra cấu hình hiện tại.
- Khởi tạo một phiên tìm kiếm video.
- Yêu cầu các frame trong tab thu thập video có thể tua.
- Thu thập kết quả từ từng frame.
- Chấm điểm và chọn duy nhất một video.
- Gửi lệnh tới đúng frame chứa video được chọn.
- Nhận kết quả thực hiện.
- Xử lý timeout và lỗi.

Không thực hiện việc tìm kiếm DOM hoặc trực tiếp điều khiển video từ background service worker.

**Lưu ý kiến trúc Manifest V3:**

Service Worker có thể bị Chrome tạm dừng và khởi động lại. Không lưu cấu hình lâu dài trong biến global của background.js. Dữ liệu cấu hình phải được đọc từ `chrome.storage.local`.

Các biến trong bộ nhớ chỉ được sử dụng cho trạng thái điều phối tạm thời và phải có timeout, cơ chế giải phóng.

### 5.3. content.js

Mỗi frame có một content script độc lập.

Các nhiệm vụ:

- Đọc cấu hình.
- Lắng nghe thay đổi cấu hình.
- Bắt phím tắt.
- Thu thập video HTML5 trong frame hiện tại.
- Xác định video có thể seek.
- Báo cáo danh sách video cho background.
- Nhận lệnh tua đúng video được chọn.
- Thực hiện seek và xác nhận kết quả.
- Hiển thị thông báo trên frame chứa video.

Không để mỗi frame tự quyết định và tự tua video khi nhận được phím tắt.

### 5.4. popup.html, popup.css, popup.js

Chịu trách nhiệm hoàn toàn về UI và xử lý cấu hình.

Popup không được chứa logic tìm kiếm hoặc điều khiển video.

### 5.5. overlay.css

Chỉ định dạng thông báo tua.

CSS phải được giới hạn trong phạm vi thành phần Skip90, tránh ghi đè hoặc ảnh hưởng đến CSS của website.

---

## 6. Cơ chế điều phối video giữa các frame

Đây là phần kỹ thuật quan trọng nhất của dự án.

Yêu cầu bắt buộc: **Một lần nhấn phím chỉ được phép tạo ra tối đa một thao tác seek thành công trên toàn tab.**

Không được để từng frame tự tua độc lập.

### 6.1. Quy trình hoạt động

```text
User presses S
       │
       ▼
Focused Frame receives keydown
       │
       ▼
Send SKIP_REQUEST
       │
       ▼
Background Coordinator
       │
       ▼
Broadcast DISCOVER_VIDEOS
       │
       ├── Main Frame
       ├── Iframe A
       ├── Iframe B
       └── Iframe C
              │
              ▼
       Collect candidate reports
              │
              ▼
       Rank candidates globally
              │
              ▼
       Select ONE candidate
              │
              ▼
       Send SEEK command to winning frame
              │
              ▼
       Validate seek result
              │
              ▼
       Show toast
```

### 6.2. Message Protocol

Thiết kế message protocol rõ ràng, có `requestId` để phân biệt từng thao tác.

Các message type cần thiết:

- `SKIP_REQUEST`
- `DISCOVER_VIDEOS`
- `VIDEO_CANDIDATES`
- `EXECUTE_SEEK`
- `SEEK_RESULT`
- `SKIP_FAILED`

Yêu cầu:

- Background tạo request ID duy nhất cho mỗi lần thao tác.
- Mỗi frame trả về danh sách candidate riêng.
- Background sử dụng `sender.frameId` để xác định nguồn báo cáo.
- Các frame không tự gửi lệnh seek khi nhận thông báo discovery.
- Background chỉ gửi `EXECUTE_SEEK` tới frame thắng cuộc.
- Chỉ xử lý kết quả thuộc đúng request ID.
- Có timeout nếu frame không phản hồi.
- Có cơ chế khóa thao tác theo tab để chống xử lý trùng.
- Không dùng `window.postMessage` làm kênh điều khiển nội bộ giữa các frame nếu không cần thiết.

Một hướng triển khai phù hợp là broadcast thông điệp bằng `chrome.tabs.sendMessage()` không chỉ định `frameId`, sau đó từng content script tự gửi báo cáo candidate qua `chrome.runtime.sendMessage()`.

Không để nhiều content script cùng trả lời trực tiếp cho một broadcast request theo cách làm kết quả bị ghi đè hoặc chỉ nhận được phản hồi không xác định.

### 6.3. Xác thực message

- Xác thực nguồn message.
- Xác thực `sender.id`.
- Kiểm tra `sender.tab` và `sender.frameId`.
- Kiểm tra cấu trúc payload.
- Không tin dữ liệu từ website hoặc message không đúng định dạng.
- Không cho phép frame không thuộc request hiện tại thực thi lệnh tua.

---

## 7. Thuật toán lựa chọn video

Mục tiêu là tìm đúng video người dùng đang xem, không phải video lớn nhất một cách máy móc.

Mỗi frame cần thu thập các thông tin sau:

```text
candidateId
isFullscreen
lastInteractionAt
isPlaying
isPaused
isVisible
visibleArea
currentTime
duration
seekableRanges
readyState
```

Chỉ xem xét video có khả năng seek hợp lệ.

### 7.1. Thứ tự ưu tiên

Sắp xếp ứng viên theo thứ tự:

1. Video đang toàn màn hình.
2. Video người dùng vừa tương tác gần nhất.
3. Video đang phát.
4. Video có diện tích hiển thị lớn nhất.

Giải quyết trường hợp hòa bằng mức độ tương tác gần nhất và diện tích hiển thị.

Không chọn:

- Video bị ẩn.
- Video có kích thước hiển thị bằng 0.
- Video không có metadata cần thiết.
- Video không có khoảng thời gian seek hợp lệ.
- Video đã bị loại khỏi DOM.
- Video đã kết thúc mà không còn khả năng seek phù hợp.

### 7.2. Nhận diện tương tác

Theo dõi các tương tác phù hợp như:

- Pointer down.
- Click.
- Người dùng thao tác với khu vực player.
- Trạng thái phát video.

Không chỉ dựa vào sự kiện click trực tiếp trên thẻ `<video>`, vì nhiều trình phát dùng controls hoặc overlay riêng.

Lưu timestamp tương tác để so sánh giữa các frame.

### 7.3. Nhận diện fullscreen

Sử dụng Fullscreen API để kiểm tra `document.fullscreenElement`.

Video được coi là fullscreen khi:

- Chính nó là fullscreen element.
- Hoặc nó nằm bên trong fullscreen element.

Phải xử lý trường hợp fullscreen nằm trong iframe.

---

## 8. Logic tua video

### 8.1. Tính thời gian đích

```javascript
targetTime = currentTime + skipSeconds;
```

Ví dụ:

```text
Current Time: 200 seconds
Skip Duration: 90 seconds
Target Time: 290 seconds
```

Dùng `currentTime` để seek.

### 8.2. Seekable Ranges

Không chỉ sử dụng `video.duration` để giới hạn thời gian đích.

Phải đọc `video.seekable` và xử lý đầy đủ các khoảng seek hợp lệ.

Yêu cầu:

- Kiểm tra các khoảng seekable.
- Xác định thời gian đích có thuộc khoảng seek được hay không.
- Không seek vào khoảng thời gian không hợp lệ.
- Nếu thời gian đích nằm trong khoảng không thể seek, chọn điểm tiến hợp lệ gần nhất nhưng không vượt quá thời gian đích.
- Không tạo thao tác tua lùi.
- Nếu không tồn tại điểm seek hợp lệ lớn hơn thời gian hiện tại, bỏ qua lần nhấn.
- Xử lý video có `duration === Infinity` khi có seekable range phù hợp, chẳng hạn live DVR.

Khi video gần cuối:

- Giới hạn thời gian đích theo duration và seekable ranges.
- Nếu chỉ tua được một phần, vẫn thực hiện phần hợp lệ.
- Ghi nhận khoảng thời gian thực tế đã tua.

### 8.3. Giữ trạng thái playback

- Nếu video đang phát, giữ trạng thái phát trong khả năng của trình duyệt và trình phát.
- Nếu video đang pause, không tự động phát lại.
- Không gọi `play()` một cách không cần thiết.
- Không gọi `pause()` một cách không cần thiết.
- Không làm thay đổi tốc độ phát.
- Không ép video chuyển sang trạng thái khác do thao tác seek.

### 8.4. Xác nhận thao tác

Không coi việc gán `currentTime` là đủ để xác nhận thành công.

Cần:

- Xử lý exception.
- Theo dõi `seeking` và `seeked` khi phù hợp.
- Kiểm tra `currentTime` sau khi seek.
- Có timeout tránh chờ vô hạn.
- Không hiện thông báo thành công khi seek thất bại.

Nếu video bị thay thế trong lúc xử lý, phải kiểm tra lại candidate trước khi thực thi.

### 8.5. Thông báo sau khi tua

Chỉ hiện toast sau khi xác nhận thao tác thành công.

Ví dụ:

```text
+1:30
```

Nếu chỉ tua được 40 giây:

```text
+0:40
```

Thông báo dựa trên thời lượng thực tế, không phải thời lượng cấu hình.

Toast phải:

- Ngắn gọn.
- Dễ nhìn.
- Không che các controls quan trọng.
- Không xuất hiện nhiều lần trong một lần nhấn.
- Tự động biến mất sau một khoảng thời gian ngắn.

### 8.6. Fullscreen Toast

Đây là trường hợp phải kiểm thử riêng.

Nếu fullscreen element là container chứa video, ưu tiên hiển thị overlay bên trong fullscreen element.

Nếu chính `<video>` là fullscreen element, phải nghiên cứu và thử nghiệm giải pháp top-layer phù hợp trên Chrome, chẳng hạn popover API, để xác nhận overlay vẫn hiển thị phía trên video.

Không được tuyên bố hỗ trợ fullscreen hoàn chỉnh nếu chỉ kiểm tra trường hợp fullscreen container.

---

## 9. Xử lý bàn phím

Lắng nghe `keydown` trong content script tại từng frame phù hợp.

Các trường hợp phải bỏ qua:

- Extension đang tắt.
- Người dùng đang gõ trong `input`.
- Người dùng đang gõ trong `textarea`.
- Người dùng đang tương tác với `select`.
- Khu vực `contenteditable`.
- Vùng soạn thảo có role textbox.
- Đang sử dụng IME.
- `event.isComposing === true`.
- `event.keyCode === 229` trong trường hợp cần fallback.
- Có Ctrl, Alt, Meta hoặc Shift.
- `event.repeat === true`.

Phải xét cả Shadow DOM khi xác định nguồn sự kiện nằm trong vùng nhập liệu.

Không chặn sự kiện bàn phím nếu tiện ích đang tắt hoặc người dùng đang nhập dữ liệu.

Dùng capture phase để tăng khả năng nhận sự kiện trước shortcut của website.

Chỉ gọi `preventDefault()` khi nhận diện được một lần nhấn hợp lệ thuộc shortcut của Skip90. Tránh sử dụng `stopImmediatePropagation()` làm gián đoạn các xử lý không liên quan của website.

---

## 10. Thiết kế UI/UX

Sử dụng UI UX Pro Max và Frontend Design để xây dựng trải nghiệm sản phẩm.

Không thiết kế popup theo kiểu form quản trị thông thường.

### 10.1. Định hướng thiết kế

- Minimal.
- Modern.
- Compact.
- Premium utility.
- Clear visual hierarchy.
- Consistent spacing.
- Accessible controls.
- Responsive within Chrome popup constraints.

### 10.2. Nhận diện thương hiệu

Tên sản phẩm: **Skip90**

Logo:

- Hai tam giác trắng hướng sang phải.
- Nền hình vuông tím chàm.
- Bo góc.
- Hình khối đơn giản, dễ nhận diện ở kích thước 16 px.
- Không thêm quá nhiều chi tiết trang trí.

Màu tím chàm là màu nhận diện chính. Các màu phụ cần được chọn dựa trên design system do UI UX Pro Max đề xuất.

### 10.3. Typography

- Ưu tiên Inter nếu được đóng gói cục bộ.
- Không tải font từ Google Fonts hoặc dịch vụ bên ngoài.
- Fallback sang system font.
- Thể hiện thời lượng bằng kiểu chữ rõ ràng, dễ đọc.

### 10.4. Popup UX

- Chiều rộng mục tiêu khoảng 320 px.
- Khoảng cách giữa các thành phần hợp lý.
- Có trạng thái bật/tắt dễ nhận biết.
- Các preset phải thể hiện preset đang được chọn.
- Input phút và giây có label riêng.
- Nút Lưu có phản hồi rõ ràng.
- Có thông báo lỗi validation.
- Có phản hồi khi lưu thành công.
- Có focus state và keyboard navigation.
- Tương phản văn bản đáp ứng WCAG AA ở những thành phần phù hợp.

Không sử dụng animation quá mức hoặc làm chậm thao tác cấu hình.

---

## 11. Icon và tài nguyên thiết kế

Tệp nguồn logo:

```text
icons/logo.svg
```

Xuất các kích thước PNG:

```text
icon-16.png
icon-32.png
icon-48.png
icon-128.png
```

Yêu cầu:

- Dùng chung nhận diện thương hiệu.
- Không bị mờ khi thu nhỏ.
- Kiểm tra khả năng nhận diện tại 16 px.
- Kiểm tra nền sáng và tối.
- Có thể chỉnh sửa lại logo gốc.
- Không phụ thuộc vào hình ảnh từ URL bên ngoài.

Popup hiển thị biểu tượng cạnh chữ Skip90.

Chuẩn bị thêm hình giới thiệu sản phẩm và ảnh chụp popup phục vụ Chrome Web Store.

---

## 12. Security và Privacy

Skip90 chỉ thực hiện thao tác cục bộ.

Các nguyên tắc bắt buộc:

- Không thu thập lịch sử xem video.
- Không gửi dữ liệu người dùng ra server.
- Không có analytics hoặc telemetry.
- Không tải JavaScript từ xa.
- Không sử dụng `eval()` hoặc `new Function()`.
- Không đưa dữ liệu website vào context thực thi đặc quyền.
- Kiểm tra mọi message từ content script.
- Giới hạn quyền trong manifest ở mức tối thiểu.
- Giải thích rõ lý do cần quyền truy cập website.
- Không yêu cầu quyền không cần thiết.

Nếu cần quyền truy cập HTTP/HTTPS trên mọi website để xử lý video trong iframe khác nguồn, phải ghi rõ lý do trong tài liệu dự án.

Không vượt qua cơ chế bảo vệ DRM, chính sách bảo mật của website hoặc giới hạn quyền của Chrome.

---

## 13. Thứ tự triển khai

### Phase 0 — Repository Inspection & Architecture

Trước khi code:

1. Kiểm tra repository hiện tại.
2. Kiểm tra Agent Skills đã cài.
3. Đọc các skill liên quan.
4. Nghiên cứu tài liệu Chrome Manifest V3.
5. Phân tích các rủi ro kỹ thuật.
6. Thiết kế message protocol.
7. Thiết kế thuật toán chọn video.
8. Xác định quyền cần khai báo.
9. Xây dựng test plan.

Tạo:

- `docs/architecture.md`
- `docs/test-plan.md`

Không dừng lại ở việc viết tài liệu. Tiếp tục triển khai theo roadmap nếu không có blocker thực sự.

### Phase 1 — UI/UX & Branding

1. Xác định design system.
2. Thiết kế logo.
3. Dựng popup HTML/CSS.
4. Triển khai validation.
5. Triển khai trạng thái bật/tắt.
6. Hoàn thiện icon PNG.
7. Kiểm tra giao diện popup.

Ưu tiên chất lượng giao diện trước khi triển khai logic phức tạp.

### Phase 2 — Configuration & Storage

1. Khởi tạo cấu hình mặc định.
2. Đọc và ghi `chrome.storage.local`.
3. Đồng bộ cấu hình giữa popup, background và content scripts.
4. Đăng ký xử lý thay đổi cấu hình.
5. Kiểm tra tab đang mở nhận cấu hình mới ngay sau khi lưu.

### Phase 3 — Video Handling

1. Phát hiện video HTML5 trong frame chính.
2. Kiểm tra điều kiện seek.
3. Triển khai logic tính thời gian đích.
4. Xử lý seekable ranges.
5. Xử lý video gần cuối.
6. Xác nhận thao tác seek thành công.
7. Triển khai toast.

### Phase 4 — Cross-frame Coordinator

1. Phát hiện video trong nhiều frame.
2. Triển khai message protocol.
3. Thu thập candidate từ toàn tab.
4. Triển khai global ranking.
5. Chọn duy nhất một candidate.
6. Gửi lệnh tới đúng frame.
7. Kiểm tra timeout và race conditions.
8. Xử lý fullscreen trong iframe.
9. Kiểm tra nhiều video trong cùng một tab.

### Phase 5 — Robustness & Edge Cases

Kiểm tra:

- Chuyển tập không reload trang.
- Thay thế video bằng player mới.
- Video chưa có metadata.
- Video đang seeking.
- Video bị ẩn.
- Video gần cuối.
- Video có duration vô hạn.
- Iframe khác nguồn.
- Nhiều frame.
- Fullscreen video.
- Fullscreen container.
- Pause/play.
- Bật/tắt extension.
- Đổi shortcut.
- IME.
- Keyboard conflict.

### Phase 6 — Testing & Release

1. Test bằng video HTML5 mẫu.
2. Test iframe cùng nguồn và khác nguồn.
3. Test trên Chrome thực tế.
4. Sửa các lỗi phát hiện.
5. Chạy lại regression tests.
6. Chuẩn bị bản Load unpacked.
7. Hoàn thiện README.
8. Chuẩn bị nội dung Chrome Web Store.
9. Đóng gói bản cài thử.

---

## 14. Acceptance Criteria — Tiêu chí nghiệm thu

### A. Configuration

| Test | Expected |
|---|---|
| Cài lần đầu | Enabled, 90 giây, phím S |
| Chọn preset 1:30 | Giá trị 90 giây |
| Nhập 1 phút 40 giây | Giá trị 100 giây |
| Nhập giây 60 | Validation error |
| Nhập tổng thời gian 0 | Không cho lưu |
| Đổi phím sang A | Shortcut A hoạt động |
| Tắt extension | Không tua video |
| Mở lại Chrome | Cấu hình được giữ |

### B. Video Seeking

| Test | Expected |
|---|---|
| 03:20 + 90 giây | 04:50 |
| 03:20 + 100 giây | 05:00 |
| 03:20 + 60 giây | 04:20 |
| Video còn 40 giây | Chỉ tua 40 giây |
| Video đang pause | Vẫn pause |
| Video đang play | Tiếp tục phát nếu player cho phép |
| Không có seekable range | Không tua, không toast |
| Seek thất bại | Không toast thành công |

### C. Frame Coordination

| Test | Expected |
|---|---|
| Một video trong main frame | Tua chính xác |
| Một video trong iframe | Tua chính xác |
| Hai video đang phát | Chọn một video theo ranking |
| Video trong fullscreen iframe | Ưu tiên video fullscreen |
| Nhấn S liên tục | Không tạo thao tác trùng ngoài ý muốn |
| Frame không phản hồi | Timeout, không báo thành công |
| Frame thay đổi video | Không thao tác vào video cũ |

### D. Keyboard

| Test | Expected |
|---|---|
| Nhấn S bình thường | Thực hiện shortcut |
| Gõ trong input | Bỏ qua |
| Gõ trong textarea | Bỏ qua |
| Gõ trong contenteditable | Bỏ qua |
| Đang dùng IME | Bỏ qua |
| Giữ phím | Không lặp thao tác |
| Có Ctrl/Alt/Meta | Bỏ qua |
| Extension bị tắt | Bỏ qua |

### E. UI/UX

- Popup đúng kích thước mục tiêu.
- Logo rõ ở 16 px.
- Nút preset có trạng thái selected.
- Validation hoạt động.
- Nút Lưu có phản hồi.
- Giao diện không bị tràn.
- Không có font hoặc tài nguyên phụ thuộc network.
- Các thao tác chính sử dụng được bằng bàn phím.

Chỉ đánh dấu Passed khi đã thực hiện kiểm thử. Test chưa chạy phải ghi là Not Tested, không được tự đánh dấu thành công.

---

## 15. Testing Environment

Sử dụng Chrome thực tế với tiện ích được cài bằng Load unpacked.

Chuẩn bị các trang test:

1. Video HTML5 trong trang chính.
2. Video HTML5 trong iframe cùng nguồn.
3. Video HTML5 trong iframe khác nguồn.
4. Trang có nhiều video.
5. Trang có player container hỗ trợ fullscreen.
6. Trang sử dụng video element làm fullscreen element.

Ưu tiên tạo test fixture độc lập trong `tests/fixtures/`.

Không yêu cầu người dùng cung cấp URL anime để hoàn thành các test cơ bản. Kiểm tra bằng fixture trước, sau đó mới kiểm chứng trên website streaming thực tế khi có URL.

Không xem việc kiểm thử thành công trên một website là bằng chứng tương thích với mọi website.

---

## 16. Tài liệu và bàn giao

### README.md

Phải bao gồm:

- Giới thiệu Skip90.
- Tính năng.
- Cách cài đặt Load unpacked.
- Cách sử dụng.
- Cách đổi phím tắt.
- Cách thay đổi thời lượng.
- Cách xử lý lỗi cơ bản.
- Giới hạn tương thích đã xác định.

### Chrome Web Store

Chuẩn bị:

- Product name: Skip90.
- Short description.
- Full description.
- Icon 128 px.
- Ảnh chụp popup.
- Hình giới thiệu sản phẩm.
- Danh sách quyền và giải thích quyền.

Không tuyên bố tương thích với nền tảng hoặc website chưa được kiểm thử.

---

## 17. Quy tắc làm việc khi dùng nhiều Agent

Nếu có khả năng phối hợp nhiều coding agent:

**Claude Code — Tech Lead**

- Đọc và phân tích yêu cầu.
- Đọc các Agent Skills liên quan.
- Thiết kế kiến trúc.
- Phân chia công việc.
- Giao nhiệm vụ triển khai.
- Review kết quả.
- Kiểm tra tích hợp và acceptance criteria.
- Phát hiện và yêu cầu sửa lỗi.

**Codex — Implementation Engineer**

- Triển khai từng module được giao.
- Tuân thủ kiến trúc và giao diện message protocol.
- Không tự ý thay đổi phạm vi dự án.
- Viết và chạy test tương ứng.
- Báo cáo file đã thay đổi và kết quả kiểm thử.

Quy tắc phối hợp:

- Không cho hai agent sửa cùng một file cùng lúc.
- Các quyết định kiến trúc phải được thống nhất trước.
- Codex không tự ý thay đổi interface đã được duyệt.
- Claude phải review code trước khi tích hợp.
- Không chấp nhận implementation chỉ dựa trên báo cáo của agent khác mà không kiểm tra.

Nếu chỉ có một agent, thực hiện toàn bộ các vai trò theo từng giai đoạn.

---

## 18. Tài liệu tham khảo chính thức

**Chrome Extension**

- Manifest: https://developer.chrome.com/docs/extensions/reference/manifest
- Content Scripts: https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts
- Extension Service Worker Lifecycle: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle
- Declare Permissions: https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions
- Chrome Extensions API: https://developer.chrome.com/docs/extensions/reference/api

**Web Platform**

- HTMLMediaElement: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement
- HTMLMediaElement.seekable: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/seekable
- Fullscreen API: https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API
- KeyboardEvent: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent

Luôn ưu tiên tài liệu mới nhất và kiểm tra compatibility với phiên bản Chrome mục tiêu.

---

## 19. Final Instructions

Bắt đầu bằng việc kiểm tra repository và các Agent Skills có sẵn.

Sau đó:

1. Phân tích yêu cầu.
2. Xác định rủi ro kỹ thuật.
3. Thiết kế kiến trúc.
4. Xây dựng design system.
5. Triển khai theo từng phase.
6. Kiểm thử các acceptance criteria.
7. Review security và code quality.
8. Hoàn thiện tài liệu và bản cài thử.

Không bỏ qua các edge case quan trọng để hoàn thành nhanh hơn.

Không tạo tính năng ngoài phạm vi MVP.

Không sử dụng workaround thiếu ổn định chỉ để làm cho demo hoạt động.

**Definition of Done:** Skip90 phải là một Chrome Extension Manifest V3 có thể Load unpacked trực tiếp, popup hoạt động hoàn chỉnh, cấu hình được lưu bền vững, tua đúng một video được ưu tiên trên toàn tab, hoạt động tốt trong các trường hợp iframe và fullscreen đã được kiểm chứng, có test plan, README và báo cáo nghiệm thu trung thực.