# API Contract — Auth API

Tài liệu này xác định chi tiết hợp đồng API (API Contract) cho dịch vụ Xác thực người dùng (Auth API), phục vụ làm chuẩn đối soát giữa frontend và backend trong suốt quá trình phát triển.

---

## 1. Thông tin chung & Thiết kế hệ thống

- **Base URL (Local):** `http://localhost:3000`
- **Môi trường triển khai:** Render (Node.js & MongoDB Atlas)
- **Định dạng dữ liệu:** `application/json` (cho cả Request và Response body)
- **Cơ chế xác thực:** JWT (JSON Web Token) truyền qua header `Authorization: Bearer <token>`
- **Thời hạn token:** `1d` (24 giờ)
- **Cơ chế Logout:** **Stateless** — Server phản hồi thành công và hướng dẫn client tự hủy/xóa token khỏi bộ lưu trữ (LocalStorage, SessionStorage hoặc In-Memory). Không lưu trữ token blacklist trong database.
- **Phân quyền (RBAC):**
  - Mọi tài khoản tạo qua API công khai (`/api/auth/register`) mặc định có role là `user`. Client không thể tự chỉ định role `admin`.
  - Tài khoản `admin` chỉ được khởi tạo qua script nội bộ (`npm run seed:admin`).

---

## 2. Quy ước mã trạng thái HTTP (Status Codes) & Chuẩn xử lý lỗi

### 2.1. Bảng mã trạng thái HTTP

| Status Code | Tên chuẩn | Ý nghĩa sử dụng trong API |
| :--- | :--- | :--- |
| **`200 OK`** | OK | Thao tác thành công (`login`, `me`, `change-password`, `logout`, `health`) |
| **`201 Created`** | Created | Tạo tài nguyên mới thành công (`register`) |
| **`400 Bad Request`** | Bad Request | Dữ liệu đầu vào thiếu hoặc không hợp lệ theo quy tắc validation |
| **`401 Unauthorized`** | Unauthorized | Thiếu token, token không hợp lệ, token hết hạn, sai mật khẩu |
| **`403 Forbidden`** | Forbidden | Người dùng không đủ quyền truy cập (thiếu role yêu cầu) |
| **`404 Not Found`** | Not Found | Route hoặc tài nguyên không tồn tại |
| **`409 Conflict`** | Conflict | Trùng lặp dữ liệu độc nhất (ví dụ: email đã được đăng ký) |
| **`500 Internal Server Error`** | Server Error | Lỗi hệ thống bất ngờ phía server |

### 2.2. Chuẩn cấu trúc Response lỗi (Consistent Error Response)

Mọi phản hồi lỗi từ API **bắt buộc** tuân thủ đúng cấu trúc JSON sau:

```json
{
  "message": "Mô tả chi tiết lỗi dành cho người dùng",
  "error": "Tên loại lỗi (Bad Request, Unauthorized, Forbidden, Conflict, Internal Server Error,...)",
  "statusCode": 401
}
```

> **Lưu ý bảo mật:**
> - Tuyệt đối không trả về stack trace trong môi trường `production`.
> - Tuyệt đối không bao gồm `password`, `hash`, hoặc thông tin nhạy cảm trong response lỗi hay log server.

---

## 3. Quy tắc kiểm tra tính hợp lệ dữ liệu (Validation Rules)

1. **`name`**:
   - Bắt buộc.
   - Chuỗi ký tự, cắt khoảng trắng đầu/cuối (trimmed).
   - Độ dài: từ 2 đến 50 ký tự. Không được rỗng.
2. **`email`**:
   - Bắt buộc.
   - Định dạng email tiêu chuẩn (RFC 5322).
   - Được chuẩn hóa tự động: chuyển toàn bộ về chữ thường (`lowercase`) và cắt khoảng trắng (`trimmed`).
3. **`password`**:
   - Bắt buộc.
   - Độ dài: từ 8 đến 128 ký tự.
   - Được băm bằng thuật toán `bcrypt` với cost factor (salt rounds) tối thiểu là `12` trước khi lưu vào cơ sở dữ liệu.
4. **`currentPassword` / `newPassword`**:
   - Bắt buộc khi đổi mật khẩu.
   - `newPassword` phải tối thiểu 8 ký tự và phải khác `currentPassword`.

---

## 4. Danh sách Endpoints chi tiết

### 4.1. `GET /health` — Kiểm tra trạng thái máy chủ

- **Mô tả:** Endpoint kiểm tra độ sẵn sàng của hệ thống (phục vụ health check trên Render / monitoring).
- **Quyền hạn:** Công khai (Public).
- **Request Headers:** Không yêu cầu.
- **Request Body:** Không có.

#### Response thành công (`200 OK`):
```json
{
  "status": "ok",
  "uptime": 124.5,
  "timestamp": "2026-10-05T03:00:00.000Z"
}
```

---

### 4.2. `POST /api/auth/register` — Đăng ký tài khoản

- **Mô tả:** Đăng ký tài khoản người dùng mới. Mật khẩu được băm bằng `bcrypt`, tài khoản mặc định gán role `user`.
- **Quyền hạn:** Công khai (Public).
- **Request Headers:**
  - `Content-Type: application/json`

#### Request Body:
```json
{
  "name": "Nguyen Van A",
  "email": "user@example.com",
  "password": "Password123"
}
```

#### Response thành công (`201 Created`):
```json
{
  "message": "Đăng ký tài khoản thành công",
  "user": {
    "id": "662c8b7f3e9b2d4b7f1a2c3d",
    "name": "Nguyen Van A",
    "email": "user@example.com",
    "role": "user"
  }
}
```

#### Response lỗi thường gặp:
- **`400 Bad Request`** (Dữ liệu thiếu hoặc không hợp lệ):
  ```json
  {
    "message": "Mật khẩu phải có độ dài tối thiểu 8 ký tự",
    "error": "Bad Request",
    "statusCode": 400
  }
  ```
- **`409 Conflict`** (Email đã tồn tại):
  ```json
  {
    "message": "Email đã được sử dụng",
    "error": "Conflict",
    "statusCode": 409
  }
  ```

---

### 4.3. `POST /api/auth/login` — Đăng nhập & Nhận JWT

- **Mô tả:** Xác thực thông tin người dùng và cấp JWT Bearer token có thời hạn 1 ngày.
- **Quyền hạn:** Công khai (Public).
- **Request Headers:**
  - `Content-Type: application/json`

#### Request Body:
```json
{
  "email": "user@example.com",
  "password": "Password123"
}
```

#### Response thành công (`200 OK`):
```json
{
  "message": "Đăng nhập thành công",
  "user": {
    "id": "662c8b7f3e9b2d4b7f1a2c3d",
    "name": "Nguyen Van A",
    "email": "user@example.com",
    "role": "user"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "1d"
}
```

#### Response lỗi:
- **`400 Bad Request`** (Thiếu email hoặc password):
  ```json
  {
    "message": "Vui lòng cung cấp đầy đủ email và mật khẩu",
    "error": "Bad Request",
    "statusCode": 400
  }
  ```
- **`401 Unauthorized`** (Sai thông tin đăng nhập — Dùng thông điệp chung để chống user enumeration):
  ```json
  {
    "message": "Email hoặc mật khẩu không đúng",
    "error": "Unauthorized",
    "statusCode": 401
  }
  ```

---

### 4.4. `GET /api/auth/me` — Lấy thông tin người dùng hiện tại

- **Mô tả:** Lấy thông tin hồ sơ của người dùng hiện tại dựa trên JWT hợp lệ.
- **Quyền hạn:** Đã đăng nhập (`authMiddleware`).
- **Request Headers:**
  - `Authorization: Bearer <token>`
- **Request Body:** Không có.

#### Response thành công (`200 OK`):
```json
{
  "message": "Lấy thông tin người dùng thành công",
  "user": {
    "id": "662c8b7f3e9b2d4b7f1a2c3d",
    "name": "Nguyen Van A",
    "email": "user@example.com",
    "role": "user"
  }
}
```

#### Response lỗi:
- **`401 Unauthorized`** (Thiếu token, sai token, hoặc token hết hạn):
  ```json
  {
    "message": "Token không hợp lệ hoặc đã hết hạn",
    "error": "Unauthorized",
    "statusCode": 401
  }
  ```

---

### 4.5. `PUT /api/auth/change-password` — Đổi mật khẩu

- **Mô tả:** Đổi mật khẩu cho người dùng hiện tại. Yêu cầu mật khẩu cũ chính xác và cập nhật `passwordChangedAt` để vô hiệu hóa các token được cấp trước đó.
- **Quyền hạn:** Đã đăng nhập (`authMiddleware`).
- **Request Headers:**
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`

#### Request Body:
```json
{
  "currentPassword": "Password123",
  "newPassword": "NewSecurePassword456"
}
```

#### Response thành công (`200 OK`):
```json
{
  "message": "Đổi mật khẩu thành công. Vui lòng đăng nhập lại với mật khẩu mới"
}
```

#### Response lỗi:
- **`400 Bad Request`** (Mật khẩu mới không đủ độ dài hoặc trùng với mật khẩu cũ):
  ```json
  {
    "message": "Mật khẩu mới không được trùng với mật khẩu hiện tại",
    "error": "Bad Request",
    "statusCode": 400
  }
  ```
- **`401 Unauthorized`** (Mật khẩu hiện tại không chính xác):
  ```json
  {
    "message": "Mật khẩu hiện tại không đúng",
    "error": "Unauthorized",
    "statusCode": 401
  }
  ```

---

### 4.6. `POST /api/auth/logout` — Đăng xuất

- **Mô tả:** Phản hồi trạng thái đăng xuất thành công. Do kiến trúc Stateless JWT, API không lưu trạng thái session hay blacklist token trên server; phía Client chịu trách nhiệm xóa token khỏi bộ nhớ lưu trữ sau khi gọi API này.
- **Quyền hạn:** Đã đăng nhập (`authMiddleware`).
- **Request Headers:**
  - `Authorization: Bearer <token>`
- **Request Body:** Không có.

#### Response thành công (`200 OK`):
```json
{
  "message": "Đăng xuất thành công. Vui lòng xóa token phía client"
}
```

#### Response lỗi:
- **`401 Unauthorized`** (Không có token hoặc token không hợp lệ):
  ```json
  {
    "message": "Token không hợp lệ hoặc đã hết hạn",
    "error": "Unauthorized",
    "statusCode": 401
  }
  ```

---

## 5. Danh mục các thuộc tính trường dữ liệu User (Safe User Projection)

Trong tất cả các phản hồi trả về thông tin người dùng (`register`, `login`, `me`), object `user` chỉ chứa các trường an toàn sau:

| Trường | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| `id` | `String` | MongoDB ObjectID dạng hex string |
| `name` | `String` | Họ tên người dùng |
| `email` | `String` | Địa chỉ email người dùng |
| `role` | `String` | Quyền hạn (`user` hoặc `admin`) |

> **Tuyệt đối loại trừ:**
> - Trường `password` (hash)
> - Trường `__v` (phiên bản Mongoose)
> - Trường `passwordChangedAt`
