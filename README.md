# 🍻 Beer Club - Kèo Nhậu Vote (19/10 - 25/10/2026)

Hệ thống bình chọn kèo nhậu thời gian thực (Real-time Voting Web App) cho tuần từ **19/10/2026 đến 25/10/2026**, tối ưu hóa hiệu năng cao hỗ trợ hơn **100 người dùng đồng thời không giật lag**.

---

## ✨ Tính Năng Nổi Bật

- **Bố cục trực quan**:
  - Ô textbox nhập tên ở trên kèm avatar vui nhộn (🍺, 🍻, 🥩, 👑, 🥳...).
  - Ô nhập lời nhắn / gợi ý quán / ghi chú tửu lượng.
  - Danh sách tick chọn các ngày trong tuần từ **19/10/2026 đến 25/10/2026** kèm nút chọn nhanh (Cả tuần / Cuối tuần).
- **Thời gian thực (Real-time WebSocket)**:
  - Khi bất kỳ ai bỏ phiếu, số lượng vote và danh sách người tham gia tự động cập nhật ngay lập tức trên màn hình của tất cả người đang mở link mà không cần tải lại trang.
- **Xem thông tin chi tiết**:
  - Chế độ **Thẻ (Cards View)**: Tỷ lệ %, tiến độ, danh sách người đã chọn từng ngày.
  - Chế độ **Bảng Ma Trận (Matrix View)**: Ma trận điểm danh phong cách When2Meet / Doodle hiển thị từng thành viên rảnh ngày nào.
  - **Huy hiệu Hot Pick 🔥**: Tự động vinh danh ngày được nhiều người chọn nhất.
- **Chia sẻ tiện lợi**:
  - 1-click sao chép link trang web.
  - Tích hợp **Mã QR Code** để bạn bè dùng camera điện thoại quét vào vote tức thì.
  - Nút **"Sao chép tóm tắt gửi Zalo"** để gửi kết quả vào nhóm chat.
- **Hiệu năng cao**:
  - Đã kiểm thử chịu tải với 100 người dùng đồng thời: **100% thành công**, tổng thời gian chỉ **104ms** (~962 req/s).

---

## 🚀 Cài Đặt & Chạy Cục Bộ (Local)

1. **Clone repository**:
   ```bash
   git clone https://github.com/hungnm-prog/beer_club.git
   cd beer_club
   ```

2. **Cài đặt dependencies**:
   ```bash
   npm install
   ```

3. **Khởi chạy máy chủ**:
   ```bash
   npm start
   ```
   Mở trình duyệt truy cập: `http://localhost:3000`

4. **Chạy kiểm thử tải 100 người dùng đồng thời**:
   ```bash
   npm run test:load
   ```

---

## 🐳 Triển Khai Docker

```bash
docker build -t beer_club .
docker run -p 3000:3000 beer_club
```

---

## 🌐 Triển Khai Miễn Phí Lên Render / Railway

Dự án đã có sẵn file [`render.yaml`](./render.yaml) và [`Dockerfile`](./Dockerfile):
1. Kết nối kho lưu trữ GitHub này với **[Render.com](https://render.com)** hoặc **[Railway.app](https://railway.app)**.
2. Chọn loại **Web Service**, hệ thống sẽ tự động build và chạy `npm start`.
