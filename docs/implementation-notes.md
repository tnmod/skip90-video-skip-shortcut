# Ghi chú triển khai

- Popup khoảng 320 px dùng tiếng Anh. Mỗi dòng có ô phút, giây, nút gán phím A–Z và nút xóa. Phím gán cho một dòng phải duy nhất. Danh sách cuộn khi dài để nút thêm và lưu luôn nằm bên dưới. Font ưu tiên Inter cài sẵn và dùng font hệ thống nếu thiết bị thiếu Inter. Tài nguyên UI được đóng gói cục bộ.
- Shortcut thuộc frame đang nhận sự kiện bàn phím. Các sự kiện do script trang web tự tạo không thể khởi động thao tác. Skip90 bắt phím ở capture phase và giữ propagation để các listener của trang vẫn hoạt động.
- Các frame có thời gian hữu hạn để báo ứng viên. Frame đích được xác định bằng ID tài liệu, và chỉ giữ dữ liệu ứng viên đủ lâu để thực hiện lệnh tương ứng. Lần nhấn đến khi tab đang xử lý một lần nhấn khác sẽ bị bỏ qua.
- Video được quét theo yêu cầu trong DOM và shadow root mở, nên có thể tìm được video mới khi trình phát đổi tập. Kiểm tra vùng nhập liệu còn theo được focus trong shadow root đóng của Chrome. Việc đo diện tích tính viewport và phần cắt qua iframe. CSS làm ẩn iframe được xét khi tài liệu cha có content script. Một lớp phủ tùy ý của website vẫn có thể che video mà không thay đổi hình học của phần tử.
- Ảnh logo dùng cùng một SVG gốc. Bản 128 px có khoảng trong suốt theo yêu cầu Chrome Web Store. Mã tiện ích, font hệ thống và icon đều sẵn sàng ngay khi nạp unpacked.

Kết quả trình duyệt và ca chưa chạy nằm trong [báo cáo nghiệm thu](test-plan.md).
