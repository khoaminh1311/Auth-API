# User Authentication API (Auth API)

Dịch vụ RESTful API xác thực người dùng và phân quyền (RBAC) an toàn, hiệu năng cao, được xây dựng bằng **Node.js**, **Express.js**, **MongoDB (Mongoose)**, **JSON Web Token (JWT)** và **Bcrypt**.

---

## 1. Giới thiệu tổng quan & Tính năng chính

Auth API cung cấp đầy đủ các tính năng xác thực và quản lý phiên người dùng chuẩn hóa theo mô hình Stateless JWT và các tiêu chuẩn bảo mật OWASP:

- **Đăng ký tài khoản (`POST /api/auth/register`):** Tự động băm mật khẩu bằng thuật toán Bcrypt (Salt rounds = 12), mặc định gán role `user`, ngăn chặn triệt để hành vi tự leo thang đặc quyền (Privilege Escalation).
- **Đăng nhập (`POST /api/auth/login`):** Xác thực email/mật khẩu, cấp JWT có thời hạn 1 ngày (`expiresIn: "1d"`), bảo mật chống tấn công dò quét người dùng (User Enumeration Attack).
- **Tuyến đường bảo vệ (`GET /api/auth/me`):** Middleware `authMiddleware` xác thực Bearer token, trả về thông tin người dùng an toàn (không chứa mật khẩu hay thông tin nhạy cảm).
- **Đổi mật khẩu (`PUT /api/auth/change-password`):** Yêu cầu xác thực mật khẩu hiện tại, kiểm tra mật khẩu mới không trùng mật khẩu cũ, tự động cập nhật timestamp `passwordChangedAt` để vô hiệu hóa toàn bộ các JWT token được cấp trước đó.
- **Đăng xuất (`POST /api/auth/logout`):** Hỗ trợ mô hình Stateless JWT — server phản hồi thành công và hướng dẫn Client tự hủy token khỏi bộ nhớ.
- **Khởi tạo Quản trị viên (`npm run seed:admin`):** Script nội bộ độc lập giúp khởi tạo tài khoản `admin` an toàn, duy trì tính Idempotent (chạy nhiều lần an toàn).
- **Bảo vệ hệ thống nâng cao (Security Hardening):**
  - **Rate Limiting (`express-rate-limit`):** Chống brute-force trên các endpoint nhạy cảm (`/register`, `/login`, `/change-password`).
  - **Security HTTP Headers (`helmet`):** Thiết lập chuẩn OWASP headers, ẩn `X-Powered-By`.
  - **Email Validator (`validator.js`):** Kiểm tra email hợp lệ theo chuẩn quốc tế RFC 5322.
  - **Chuẩn hóa cấu trúc lỗi:** Mọi phản hồi lỗi đều tuân thủ nhất quán định dạng `{ message, error, statusCode }`, ẩn chi tiết lỗi hệ thống khi chạy ở môi trường Production.
  - **Validation mật khẩu:** Độ dài 8–128 ký tự, từ chối mật khẩu chỉ chứa khoảng trắng, bảo toàn khoảng trắng ở đầu/giữa/cuối.

---

## 2. Công nghệ sử dụng (Tech Stack)

| Thành phần | Công nghệ | Phiên bản |
|:---|:---|:---:|
| **Nền tảng thực thi** | Node.js | >= 20.0.0 |
| **Framework HTTP** | Express.js | ^4.21.2 |
| **Cơ sở dữ liệu & ODM** | MongoDB Atlas, Mongoose | ^8.9.5 |
| **Mã hóa mật khẩu** | Bcrypt | ^5.1.1 |
| **Cấp phát & Xác thực Token** | JSON Web Token (`jsonwebtoken`) | ^9.0.2 |
| **Bảo mật & Giới hạn tần suất** | Helmet, Express-Rate-Limit | ^8.0.0, ^7.5.0 |
| **Kiểm tra dữ liệu đầu vào** | Validator | ^13.12.0 |
| **Quản lý biến môi trường** | Dotenv | ^16.4.7 |

---

## 3. Yêu cầu hệ thống

Trước khi cài đặt và khởi chạy dự án, hãy đảm bảo máy tính của bạn đã cài đặt:
- **Node.js**: Phiên bản 20.0.0 trở lên
- **npm**: Phiên bản 9.x trở lên
- **MongoDB**: Chuỗi kết nối đến một cluster MongoDB Atlas đang hoạt động hoặc phiên bản MongoDB Community chạy cục bộ.

---

## 4. Hướng dẫn Cài đặt & Khởi chạy Local

### Bước 1: Sao chép mã nguồn (Clone Repository)
```bash
git clone https://github.com/khoaminh1311/Auth-API.git
cd Auth-API
```

### Bước 2: Cài đặt các gói phụ thuộc (Dependencies)
```bash
npm install
```

### Bước 3: Cấu hình biến môi trường
Tạo file `.env` từ file mẫu [.env.example](file:///.env.example):
```bash
# Trên Linux / macOS
cp .env.example .env

# Trên Windows PowerShell
copy .env.example .env
```

Mở file `.env` vừa tạo và điền các thông tin kết nối và bí mật của bạn:
```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/auth_api
JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters_long
JWT_EXPIRES_IN=1d
BCRYPT_SALT_ROUNDS=12
ADMIN_NAME=Admin User
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=AdminSecurePassword123!
CORS_ORIGIN=*
```

> [!TIP]
> Bạn có thể sinh chuỗi `JWT_SECRET` ngẫu nhiên bảo mật cao bằng lệnh:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

### Bước 4: Khởi tạo tài khoản Quản trị viên (Admin Seed)
Chạy script nội bộ để tạo tài khoản admin từ thông tin cấu hình trong `.env`:
```bash
npm run seed:admin
```
*Ghi chú: Lệnh này an toàn khi chạy nhiều lần (Idempotent). Nếu tài khoản admin đã tồn tại, script sẽ đồng bộ thông tin và đảm bảo role luôn là `admin`.*

### Bước 5: Khởi chạy máy chủ
- **Chế độ phát triển (Development với tự động reload):**
  ```bash
  npm run dev
  ```
- **Chế độ chuẩn (Production / Standard):**
  ```bash
  npm start
  ```

Sau khi khởi động thành công, server sẽ lắng nghe tại: `http://localhost:3000`.

---

## 5. Bảng giải thích chi tiết Biến Môi Trường (`.env`)

| Tên biến | Bắt buộc | Mặc định | Ý nghĩa & Mô tả |
|:---|:---:|:---:|:---|
| `PORT` | Không | `3000` | Cổng mạng HTTP mà ứng dụng Express sẽ lắng nghe. |
| `NODE_ENV` | Không | `development` | Môi trường chạy ứng dụng (`development`, `production`, hoặc `test`). Khi là `production`, server tự động ẩn stack trace và chi tiết lỗi nội bộ. |
| `MONGODB_URI` | **Có** | - | Chuỗi kết nối URI đến cơ sở dữ liệu MongoDB (kèm thông tin xác thực). |
| `JWT_SECRET` | **Có** | - | Chuỗi khóa bí mật dùng để ký và xác minh tính toàn vẹn của JSON Web Token. Khuyến nghị độ dài tối thiểu 32–64 ký tự. |
| `JWT_EXPIRES_IN` | Không | `1d` | Thời hạn sống của token được phát hành (ví dụ: `1d` = 24 giờ, `12h`, `7d`). |
| `BCRYPT_SALT_ROUNDS` | Không | `12` | Cost factor băm mật khẩu của thư viện `bcrypt`. Giá trị 12 cân bằng tối ưu giữa bảo mật và hiệu năng server. |
| `ADMIN_NAME` | Có* | - | Họ và tên của tài khoản quản trị viên (*bắt buộc khi chạy script `seed:admin`). |
| `ADMIN_EMAIL` | Có* | - | Địa chỉ email của quản trị viên (*bắt buộc khi chạy script `seed:admin`). |
| `ADMIN_PASSWORD` | Có* | - | Mật khẩu tài khoản quản trị viên (*bắt buộc khi chạy script `seed:admin`, độ dài >= 8 ký tự). |
| `CORS_ORIGIN` | Không | `*` | Danh sách domain nguồn được phép gửi request đến API (CORS). Khi deploy production, nên đặt thành domain frontend thật (ví dụ: `https://my-app.vercel.app`). |

---

## 6. Tài liệu & Danh sách API Endpoints

### 6.1. Bảng tóm tắt các Endpoints

| Phương thức | Tuyến đường (Endpoint) | Quyền hạn | Mô tả |
|:---:|:---|:---:|:---|
| `GET` | `/health` | Public | Kiểm tra trạng thái hoạt động của server và database. |
| `POST` | `/api/auth/register` | Public | Đăng ký tài khoản mới (mặc định role `user`). |
| `POST` | `/api/auth/login` | Public | Đăng nhập bằng email/mật khẩu, nhận chuỗi JWT token. |
| `GET` | `/api/auth/me` | Protected (Token) | Lấy thông tin hồ sơ của tài khoản đang đăng nhập. |
| `PUT` | `/api/auth/change-password` | Protected (Token) | Đổi mật khẩu, vô hiệu hóa token cũ. |
| `POST` | `/api/auth/logout` | Protected (Token) | Đăng xuất (Stateless - hướng dẫn client xóa token). |

---

### 6.2. Chi tiết từng Endpoint

#### 1. `GET /health` — Health Check
- **Headers:** Không yêu cầu
- **Phản hồi thành công (`200 OK`):**
  ```json
  {
    "status": "ok",
    "uptime": 125.4,
    "timestamp": "2026-10-19T10:00:00.000Z"
  }
  ```

---

#### 2. `POST /api/auth/register` — Đăng ký tài khoản
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "name": "Nguyen Van A",
    "email": "user@example.com",
    "password": "Password123!"
  }
  ```
- **Phản hồi thành công (`201 Created`):**
  ```json
  {
    "message": "Đăng ký tài khoản thành công",
    "user": {
      "id": "67139f4e2b10a4e7f3c12a89",
      "name": "Nguyen Van A",
      "email": "user@example.com",
      "role": "user"
    }
  }
  ```
- **Lỗi thường gặp:**
  - `400 Bad Request`: Thiếu trường, tên < 2 hoặc > 50 ký tự, email sai định dạng, mật khẩu < 8 hoặc > 128 ký tự, mật khẩu chỉ chứa khoảng trắng.
  - `409 Conflict`: Email đã được đăng ký trong hệ thống.
  - `429 Too Many Requests`: Gửi quá 20 yêu cầu / 15 phút từ cùng một IP.

---

#### 3. `POST /api/auth/login` — Đăng nhập
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!"
  }
  ```
- **Phản hồi thành công (`200 OK`):**
  ```json
  {
    "message": "Đăng nhập thành công",
    "user": {
      "id": "67139f4e2b10a4e7f3c12a89",
      "name": "Nguyen Van A",
      "email": "user@example.com",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "1d"
  }
  ```
- **Lỗi thường gặp:**
  - `400 Bad Request`: Thiếu email hoặc mật khẩu, sai kiểu dữ liệu.
  - `401 Unauthorized`: `"Email hoặc mật khẩu không đúng"` (thông báo chung bảo mật chống tấn công User Enumeration).
  - `429 Too Many Requests`: Vượt quá giới hạn rate limit đăng nhập.

---

#### 4. `GET /api/auth/me` — Hồ sơ người dùng hiện tại
- **Headers:** `Authorization: Bearer <token>`
- **Phản hồi thành công (`200 OK`):**
  ```json
  {
    "message": "Lấy thông tin người dùng thành công",
    "user": {
      "id": "67139f4e2b10a4e7f3c12a89",
      "name": "Nguyen Van A",
      "email": "user@example.com",
      "role": "user"
    }
  }
  ```
- **Lỗi thường gặp:**
  - `401 Unauthorized`: Thiếu header Authorization, token bị giả mạo chữ ký, token hết hạn, hoặc token đã bị vô hiệu hóa do đổi mật khẩu.

---

#### 5. `PUT /api/auth/change-password` — Đổi mật khẩu
- **Headers:**
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "currentPassword": "Password123!",
    "newPassword": "NewPassword456!"
  }
  ```
- **Phản hồi thành công (`200 OK`):**
  ```json
  {
    "message": "Đổi mật khẩu thành công. Vui lòng đăng nhập lại với mật khẩu mới"
  }
  ```
- **Lỗi thường gặp:**
  - `400 Bad Request`: `currentPassword` không phải kiểu string, `newPassword` < 8 hoặc > 128 ký tự, `newPassword` toàn khoảng trắng, hoặc `newPassword` trùng với `currentPassword`.
  - `401 Unauthorized`: Mật khẩu hiện tại không chính xác.

---

#### 6. `POST /api/auth/logout` — Đăng xuất (Stateless)
- **Headers:** `Authorization: Bearer <token>`
- **Phản hồi thành công (`200 OK`):**
  ```json
  {
    "message": "Đăng xuất thành công. Vui lòng xóa token phía client"
  }
  ```

---

### 6.3. Chuẩn phản hồi lỗi nhất quán (Consistent Error Response)

Mọi mã lỗi (`400`, `401`, `403`, `404`, `409`, `429`, `500`) đều trả về cấu trúc JSON chuẩn:
```json
{
  "message": "Mô tả chi tiết nguyên nhân lỗi cho người dùng",
  "error": "Tên phân loại lỗi (Bad Request, Unauthorized, Forbidden, Conflict, Too Many Requests,...)",
  "statusCode": 400
}
```

---

## 7. Các nguyên tắc bảo mật cốt lõi (Security Principles)

1. **Chống tấn công leo thang đặc quyền (No Privilege Escalation):**
   - API không bao giờ cho phép client truyền trường `role: "admin"` khi đăng ký tài khoản. Mọi tài khoản công khai luôn được ép cứng role là `user`.
2. **Khởi tạo Admin qua kênh độc lập (Admin Bootstrap):**
   - Tài khoản `admin` chỉ được khởi tạo thông qua script nội bộ chạy trên máy chủ: `npm run seed:admin`.
3. **Mã hóa mật khẩu an toàn với Bcrypt:**
   - Mật khẩu được băm một chiều với thuật toán `bcrypt` (12 rounds) tự động qua pre-save hook của Mongoose.
   - Không lưu trữ mật khẩu dạng văn bản rõ (plaintext).
   - Tự động ẩn trường `password` trong các truy vấn mặc định (`select: false`).
4. **Quy tắc mật khẩu chặt chẽ:**
   - Độ dài từ 8 đến 128 ký tự.
   - Không được chỉ chứa toàn bộ ký tự khoảng trắng (whitespace-only bị chặn 400).
   - Cho phép khoảng trắng ở đầu, giữa và cuối; hệ thống không tự động trim mật khẩu trước khi băm hay đăng nhập.
5. **Cơ chế thu hồi Token khi đổi mật khẩu (Token Invalidation):**
   - Mỗi khi đổi mật khẩu thành công, trường `passwordChangedAt` được cập nhật trong DB.
   - Middleware `authMiddleware` tự động so sánh thời điểm cấp token (`iat`) với `passwordChangedAt`. Mọi token cấp trước đó sẽ lập tức bị từ chối `401 Unauthorized`.
6. **Mô hình Đăng xuất Stateless:**
   - Không lưu trữ session hay blacklist token trong Database để đảm bảo tối ưu hiệu năng và khả năng scale. Client có trách nhiệm xóa token khỏi LocalStorage / In-Memory sau khi nhận phản hồi đăng xuất.
7. **Bảo mật bí mật cấu hình (Zero Secrets in Git):**
   - File `.env` chứa mật khẩu thật đã được loại trừ hoàn toàn trong `.gitignore`. Không bao giờ đưa file `.env` lên GitHub.

---

## 8. Triển khai Production (Render Deployment)

- **Nền tảng:** Render (Web Service, Singapore Region).
- **URL Triển khai chính thức:** [https://auth-api-f540.onrender.com](https://auth-api-f540.onrender.com)
- **Health Check URL:** [https://auth-api-f540.onrender.com/health](https://auth-api-f540.onrender.com/health)
- **Cấu hình trên Render Dashboard:**
  - **Build Command:** `npm install`
  - **Start Command:** `npm start`
  - **Environment Variables:** Cấu hình các biến `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN=1d`, `BCRYPT_SALT_ROUNDS=12`, `CORS_ORIGIN=*`.

---

## 9. Giới hạn hiện tại của hệ thống (Current Limitations)

Nhằm đảm bảo bám sát đúng phạm vi yêu cầu (Spec) của dự án, các tính năng sau đây **chủ động không nằm trong thiết kế ban đầu**:
- Không sử dụng cơ chế **Refresh Token** (chỉ sử dụng Access Token có thời hạn 1 ngày).
- Không duy trì **Token Blacklist** hoặc cơ sở dữ liệu session trên server (tuân thủ nguyên lý Stateless JWT).
- Không hỗ trợ xác thực qua bên thứ ba (**OAuth 2.0 / Google / Facebook / GitHub**).
- Không cung cấp API công khai để kích hoạt tài khoản qua Email OTP hoặc CRUD danh sách người dùng.

---

## 10. Bản quyền & Giấy phép (License)

Dự án được phát hành dưới giấy phép mã nguồn mở [ISC License](LICENSE). Mọi đóng góp và mã nguồn đều tuân thủ các quy tắc bảo mật và phát triển phần mềm chuẩn mực.
