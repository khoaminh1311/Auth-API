Mô tả: API xác thực người dùng với JWT — Register, Login, Protected Routes. Bảo mật với bcrypt, phân quyền RBAC (user/admin), hỗ trợ đổi mật khẩu và đăng xuất.

Topics học được:
- JWT (JSON Web Token): tạo, verify, lưu trữ (LocalStorage / Cookie httpOnly / Memory)
- bcrypt: hash password
- Middleware xác thực (authMiddleware): attach token vào Header Authorization: Bearer <token>
- Role-based access control — RBAC (admin/user)
- Xử lý lỗi có cấu trúc: { message, error, statusCode }
- Xác thực token an toàn, dễ mở rộng & tích hợp

Endpoints:

Method	Endpoint	Mô tả
POST	/api/auth/register	Đăng ký tài khoản
POST	/api/auth/login	Đăng nhập và nhận JWT
GET	/api/auth/me	Lấy thông tin người dùng hiện tại (protected)
PUT	/api/auth/change-password	Đổi mật khẩu (yêu cầu đăng nhập)
POST	/api/auth/logout	Đăng xuất (xóa token phía client)
Response mẫu — Login thành công:

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
Response mẫu — Lỗi:

{
  "message": "Email hoặc mật khẩu không đúng",
  "error": "Unauthorized",
  "statusCode": 401
}
Done Criteria:
- [ ] POST /api/auth/register — đăng ký, hash password bằng bcrypt
- [ ] POST /api/auth/login — trả về JWT + thông tin user
- [ ] GET /api/auth/me — protected route, trả về user info từ token
- [ ] PUT /api/auth/change-password — yêu cầu đăng nhập, verify mật khẩu cũ trước khi đổi
- [ ] POST /api/auth/logout — xóa token phía client
- [ ] Password không được lưu plain text
- [ ] Token hết hạn sau 1 ngày (expiresIn: "1d")
- [ ] Middleware authMiddleware bảo vệ đúng các protected routes
- [ ] Error response có cấu trúc nhất quán (message, error, statusCode)
- [ ] Deployed lên Render