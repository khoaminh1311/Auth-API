# Implementation Plan — Auth API

## Đã chốt

- Phạm vi: chỉ Auth API
- Stack: Node.js, Express.js, MongoDB/Mongoose, JWT, bcrypt, JavaScript.
- JWT truyền qua `Authorization: Bearer <token>`, hết hạn sau `1d`.
- Logout theo mô hình stateless: server phản hồi thành công, client tự xóa token.
- Mọi đăng ký mới có role `user`; admin được tạo bằng script seed.
- Không yêu cầu Swagger, Jest/Supertest, hay coverage tối thiểu.
- MongoDB production đã sẵn sàng; triển khai lên Render.

## Nguyên tắc cho AI Agents

- Thực hiện tuần tự theo phase; chỉ chuyển phase khi phần “Kiểm tra lại” đạt.
- Không commit hoặc ghi hard-code bí mật, URI MongoDB, JWT secret, hoặc mật khẩu admin.
- Không để `password` xuất hiện trong response, log, README mẫu, hay error.
- Giữ response lỗi thống nhất: `{ "message", "error", "statusCode" }`.
- Không cho client tự truyền role `admin` khi đăng ký.
- Không thêm các tính năng ngoài phạm vi như refresh token, OAuth, email verification, token blacklist, hoặc CRUD người dùng.
- Không tự thực hiện các lệnh push, pull, merge hay các lệnh làm ảnh hưởng đến repo dự án. Chỉ gợi ý các lệnh này hoặc các lệnh tạo branch để người dùng tự thực hiện chỉ khi cần thiết

## Quy tắc chung (áp dụng cho tất cả projects)
- Mỗi project phải có repository riêng trên GitHub
- Tuân thủ Git workflow: main branch là production, làm việc trên feature branch, tạo PR trước khi merge
- Commit message theo chuẩn: feat:, fix:, chore:, docs:
- Mỗi project phải được deploy trước khi coi là hoàn thành

## Git Workflow chuẩn (áp dụng từ Project 1)
-  Bắt đầu feature mới
git checkout -b feat/ten-feature

- Commit thường xuyên
git add .
git commit -m "feat: add todo filter by status"

- Push và tạo PR
git push origin feat/ten-feature
→ Tạo Pull Request trên GitHub
→ Review → Merge vào main
→ Vercel/Render tự động deploy

---

## Phase 0 — Khóa phạm vi và API contract

**Mục tiêu:** Biến spec thành một hợp đồng API rõ ràng trước khi code.

**Cần làm:**

- Xác nhận các endpoint:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
  - `PUT /api/auth/change-password`
  - `POST /api/auth/logout`
- Quy ước HTTP status:
  - Register: `201`
  - Login, Me, Change password, Logout: `200`
  - Dữ liệu đầu vào không hợp lệ: `400`
  - Email đã tồn tại: `409`
  - Thiếu/sai/hết hạn token hoặc sai mật khẩu: `401`
  - Không đủ role: `403`
  - Lỗi không xác định: `500`
- Chốt request body:
  - Register: `name`, `email`, `password`
  - Login: `email`, `password`
  - Change password: `currentPassword`, `newPassword`
- Chốt validation tối thiểu:
  - Name sau trim không rỗng.
  - Email hợp lệ, lowercase.
  - Password tối thiểu 8 ký tự.
- Viết rõ logout là stateless: API không thu hồi token trên server; client phải xóa token sau khi gọi endpoint.

**Đầu ra:**

- API contract trong `README.md` hoặc `docs/api-contract.md`.
- Danh sách status code và request/response mẫu.

**Kiểm tra lại:**

- Contract khớp toàn bộ endpoint và response mẫu trong spec.
- Không có endpoint Blog API hoặc endpoint admin công khai không được yêu cầu.

---

## Phase 1 — Khởi tạo project và nền tảng chạy ứng dụng

**Mục tiêu:** Có Express server chạy được, cấu trúc dễ mở rộng và cấu hình an toàn.

**Cần làm:**

- Khởi tạo Node.js project và cấu hình script:
  - `npm run dev`
  - `npm start`
  - `npm run seed:admin`
- Cài dependency cần thiết:
  - `express`, `mongoose`, `bcrypt`, `jsonwebtoken`, `dotenv`
  - Có thể dùng `nodemon` cho môi trường phát triển.
- Tạo cấu trúc rõ ràng, ví dụ:

```text
src/
  config/
  controllers/
  middleware/
  models/
  routes/
  services/
  utils/
  app.js
  server.js
scripts/
  seedAdmin.js
```

- Tạo `.env.example`, `.gitignore`, và không commit `.env`.
- Tạo kết nối MongoDB, chỉ khởi động HTTP server khi kết nối database thành công.
- Tạo endpoint hỗ trợ deploy: `GET /health` trả trạng thái hoạt động, không chứa dữ liệu nhạy cảm.

**Đầu ra:**

- Server chạy local thành công.
- Project có cấu trúc thư mục nhất quán.
- `.env.example` đầy đủ biến môi trường.

**Kiểm tra lại:**

- `npm start` chạy được khi có cấu hình hợp lệ.
- Ứng dụng dừng rõ ràng khi thiếu `MONGODB_URI` hoặc `JWT_SECRET`.
- `.env` và `node_modules` không được Git theo dõi.
- `GET /health` phản hồi `200`.

---

## Phase 2 — Cấu hình bảo mật và User model

**Mục tiêu:** Thiết lập dữ liệu người dùng an toàn, không lưu mật khẩu dạng plaintext.

**Cần làm:**

- Xác định biến môi trường:

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=
JWT_SECRET=
JWT_EXPIRES_IN=1d
BCRYPT_SALT_ROUNDS=12
ADMIN_NAME=
ADMIN_EMAIL=
ADMIN_PASSWORD=
```

- Tạo `User` model với:
  - `name`
  - `email`: required, unique, lowercase, trimmed
  - `password`: required, không được trả mặc định từ query
  - `role`: enum `user | admin`, mặc định `user`
  - `passwordChangedAt`: dùng để vô hiệu hóa token cũ sau khi đổi mật khẩu
  - timestamps
- Dùng unique index cho email; vẫn phải xử lý duplicate key để trả lỗi `409` thân thiện.
- Thiết kế method/model hook để bcrypt hash password trước khi lưu.
- Tạo helper chuyển User thành response an toàn: chỉ trả `id`, `name`, `email`, `role`.

**Đầu ra:**

- `User` model sẵn sàng cho xác thực.
- Password chỉ tồn tại dưới dạng hash trong MongoDB.

**Kiểm tra lại:**

- Đăng ký mẫu tạo bản ghi với password hash bắt đầu bằng định dạng bcrypt, không phải plaintext.
- Email trùng không tạo bản ghi thứ hai.
- Query thông thường không vô tình trả password.
- Role gửi từ request register bị bỏ qua; user mới luôn có role `user`.

---

## Phase 3 — Register và Login

**Mục tiêu:** Người dùng có thể đăng ký và đăng nhập để nhận JWT hợp lệ.

**Cần làm:**

- Implement `POST /api/auth/register`:
  - Validate body.
  - Kiểm tra email tồn tại.
  - Tạo user với role `user`.
  - Hash password.
  - Trả `201` với thông tin user an toàn; không trả password.
- Implement helper tạo JWT:
  - Payload chỉ cần định danh user.
  - Dùng `JWT_SECRET`.
  - Dùng `JWT_EXPIRES_IN`, mặc định `1d`.
- Implement `POST /api/auth/login`:
  - Validate body.
  - Lấy password hash có chủ đích để so sánh bcrypt.
  - Với email không tồn tại hoặc mật khẩu sai, luôn trả cùng lỗi `401` để tránh lộ email đã đăng ký.
  - Trả đúng contract:

```json
{
  "message": "Đăng nhập thành công",
  "user": {
    "id": "…",
    "name": "Nguyen Van A",
    "email": "user@example.com",
    "role": "user"
  },
  "token": "…",
  "expiresIn": "1d"
}
```

**Đầu ra:**

- Register và Login hoạt động với response ổn định.
- JWT có thể được xác minh bằng server.

**Kiểm tra lại:**

- Register thành công trả `201`.
- Đăng ký email trùng trả `409`.
- Login đúng trả token với `expiresIn: "1d"`.
- Login sai email hoặc password trả lỗi chuẩn `401`.
- Không response hoặc log nào chứa password/hash.

---

## Phase 4 — Authentication middleware và protected route

**Mục tiêu:** Bảo vệ route bằng JWT Bearer token và cung cấp thông tin user hiện tại.

**Cần làm:**

- Implement `authMiddleware`:
  - Đọc header `Authorization`.
  - Chỉ chấp nhận định dạng `Bearer <token>`.
  - Verify JWT; phân biệt token thiếu, sai, hết hạn nhưng không trả chi tiết nhạy cảm.
  - Tìm user hiện tại từ database theo định danh trong token.
  - Gắn user an toàn vào `req.user`.
  - Từ chối token của user không còn tồn tại.
  - Từ chối token phát hành trước `passwordChangedAt`.
- Implement `GET /api/auth/me`, yêu cầu `authMiddleware`.
- Trả user an toàn, không bao giờ trả password.

**Đầu ra:**

- Protected route hoạt động với JWT hợp lệ.
- Middleware tái sử dụng được cho các route sau này.

**Kiểm tra lại:**

- Token hợp lệ truy cập `/me` thành công.
- Không có header, sai format Bearer, token giả, hoặc token hết hạn đều trả `401`.
- `/me` không trả password.
- Token cũ bị từ chối sau khi password được đổi.

---

## Phase 5 — Đổi mật khẩu và logout

**Mục tiêu:** Hoàn tất các thao tác xác thực còn lại theo spec.

**Cần làm:**

- Implement `PUT /api/auth/change-password`:
  - Bắt buộc `authMiddleware`.
  - Validate `currentPassword`, `newPassword`.
  - Lấy password hash và verify `currentPassword` bằng bcrypt.
  - Không chấp nhận mật khẩu mới giống mật khẩu cũ.
  - Hash mật khẩu mới, cập nhật `passwordChangedAt`.
  - Trả thông báo thành công, yêu cầu đăng nhập lại vì token cũ đã bị vô hiệu.
- Implement `POST /api/auth/logout`:
  - Có thể yêu cầu JWT hợp lệ để giữ API nhất quán.
  - Không ghi token vào database, không blacklist.
  - Trả thông báo hướng dẫn client xóa token khỏi nơi lưu trữ.

**Đầu ra:**

- Password đổi an toàn.
- Logout đáp ứng đúng mô hình stateless đã chốt.

**Kiểm tra lại:**

- Không có token không thể đổi password.
- Mật khẩu hiện tại sai trả `401`.
- Password mới sau khi đổi đăng nhập được; password cũ không đăng nhập được.
- Token cũ không dùng được sau đổi password.
- Logout trả `200` và không tạo dữ liệu token không cần thiết trong MongoDB.

---

## Phase 6 — RBAC và seed admin

**Mục tiêu:** Có cơ chế phân quyền có thể sử dụng ngay khi thêm admin features.

**Cần làm:**

- Implement middleware `authorizeRoles(...roles)`:
  - Chạy sau `authMiddleware`.
  - Chỉ cho phép user có `req.user.role` phù hợp.
  - Từ chối bằng `403` với response lỗi chuẩn.
- Không thêm `role` vào register request contract.
- Tạo `scripts/seedAdmin.js`:
  - Đọc `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` từ environment.
  - Validate các biến bắt buộc.
  - Tạo admin nếu email chưa tồn tại.
  - Nếu email đã tồn tại, nâng role thành `admin` một cách idempotent.
  - Hash password trước khi lưu/cập nhật.
  - Không in mật khẩu hoặc hash ra console.
- Viết hướng dẫn vận hành script chỉ cho môi trường có quyền quản trị.

**Đầu ra:**

- Middleware RBAC sẵn sàng dùng.
- Có cách lặp lại được để bootstrap admin, không cần sửa dữ liệu thủ công.

**Kiểm tra lại:**

- User role `user` bị từ chối ở route/bài kiểm tra yêu cầu `admin`.
- User role `admin` được chấp nhận.
- Chạy seed hai lần không tạo hai admin trùng email.
- Thiếu biến môi trường admin khiến script dừng với thông báo an toàn.
- Không có cách nào để public register tự tạo admin.

---

## Phase 7 — Error handling, hardening và hoàn thiện response

**Mục tiêu:** API dễ tích hợp, không lộ thông tin nhạy cảm và xử lý lỗi nhất quán.

**Cần làm:**

- Tạo custom error class và error-handling middleware trung tâm.
- Chuẩn hóa mọi lỗi theo:

```json
{
  "message": "Email hoặc mật khẩu không đúng",
  "error": "Unauthorized",
  "statusCode": 401
}
```

- Xử lý riêng:
  - Validation lỗi.
  - Duplicate email.
  - JWT expired/invalid.
  - MongoDB kết nối lỗi.
  - Route không tồn tại.
  - Lỗi bất ngờ.
- Thêm hardening phù hợp cho Express:
  - Giới hạn JSON payload hợp lý.
  - CORS origin cấu hình bằng environment nếu cần cho frontend.
  - Tắt thông tin stack trace trong response production.
  - Không log Authorization header, token, password hoặc hash.
- Rà soát tất cả response để dùng một ngôn ngữ nhất quán.

**Đầu ra:**

- API có error contract thống nhất trong cả happy path và failure path.
- Cấu hình production không lộ secrets hoặc stack trace.

**Kiểm tra lại:**

- Mọi lỗi auth là `{ message, error, statusCode }`.
- Route không tồn tại trả `404` chuẩn.
- Production error không chứa stack trace.
- Không có log nhạy cảm.

---

## Phase 8 — QA thủ công end-to-end

**Mục tiêu:** Xác minh toàn bộ luồng hoạt động với MongoDB thật trước khi deploy.

**Cần làm:**

- Tạo collection Postman/Bruno hoặc tài liệu cURL gồm các case:
  1. Health check.
  2. Register thành công.
  3. Register thiếu dữ liệu.
  4. Register email trùng.
  5. Login đúng.
  6. Login sai password.
  7. Me có token.
  8. Me không có token/token sai.
  9. Change password thành công.
  10. Change password sai mật khẩu hiện tại.
  11. Xác minh token cũ bị từ chối sau đổi password.
  12. Đăng nhập bằng password mới.
  13. Logout.
  14. Chạy seed admin hai lần.
  15. RBAC user/admin.
- Kiểm tra lại dữ liệu trực tiếp trên MongoDB ở mức cần thiết: password hash, email unique, role mặc định.

**Đầu ra:**

- QA checklist đã chạy, lưu request mẫu và kết quả mong đợi.
- Danh sách lỗi phát hiện được sửa trước deploy.

**Kiểm tra lại:**

- Tất cả Done Criteria trong spec đều đạt.
- Không có response trả password/hash.
- Các endpoint protected thực sự từ chối request không có token.
- Không còn lỗi server `500` trong các input không hợp lệ đã biết.

---

## Phase 9 — Documentation và bàn giao

**Mục tiêu:** Người khác có thể chạy, dùng và vận hành API mà không cần đọc source code.

**Cần làm:**

- Hoàn thiện `README.md`:
  - Mô tả dự án và stack.
  - Yêu cầu Node.js.
  - Cài đặt và chạy local.
  - Cấu hình `.env`.
  - Cách seed admin.
  - Bảng endpoint, request body, response success/error.
  - Cách gửi Bearer token.
  - Giải thích logout stateless.
  - Cảnh báo không gửi role trong register, không commit secrets.
  - Deploy URL sau khi có Render.
- Bổ sung collection QA nếu đã tạo.
- Kiểm tra `.env.example` không chứa giá trị thật.
- Ghi rõ giới hạn hiện tại: không có refresh token, token blacklist, OAuth hoặc quản lý role qua public API.

**Đầu ra:**

- README hoàn chỉnh và có thể thực hiện được từ máy mới.
- Tài liệu API phản ánh đúng code.

**Kiểm tra lại:**

- Một người khác có thể setup từ README và `.env.example`.
- Mọi endpoint trong README tồn tại thật.
- README không lộ URI database, JWT secret, hay password admin.

---

## Phase 10 — Deploy Render và smoke test production

**Mục tiêu:** Đưa API lên Render ổn định với MongoDB production.

**Cần làm:**

- Tạo Render Web Service từ repository.
- Cấu hình:
  - Build command: `npm install`
  - Start command: `npm start`
  - Runtime Node.js phù hợp.
- Thêm environment variables trên Render:
  - `NODE_ENV=production`
  - `MONGODB_URI`
  - `JWT_SECRET`
  - `JWT_EXPIRES_IN=1d`
  - `BCRYPT_SALT_ROUNDS`
  - Các biến `ADMIN_*` chỉ khi cần chạy seed.
- Đảm bảo MongoDB production cho phép Render kết nối.
- Chạy seed admin một lần qua môi trường an toàn.
- Thực hiện smoke test production:
  - `GET /health`
  - Register/Login
  - Me với token
  - Change password
  - Logout
- Rà soát Render logs để bảo đảm không lộ secrets.

**Đầu ra:**

- URL Render hoạt động.
- Auth API chạy được với MongoDB production.
- Admin ban đầu đã được seed.

**Kiểm tra lại:**

- API public phản hồi qua HTTPS.
- Database production kết nối thành công sau redeploy.
- JWT tạo ở production dùng được cho protected routes.
- Done Criteria cuối cùng đều được đánh dấu hoàn thành.

---

## Definition of Done cuối cùng

- [ ] Register hash password bằng bcrypt.
- [ ] Login trả JWT, user an toàn và `expiresIn: "1d"`.
- [ ] `/me` được bảo vệ bởi `authMiddleware`.
- [ ] Change password yêu cầu token và xác minh password cũ.
- [ ] Logout hướng dẫn client xóa token theo stateless JWT.
- [ ] Role mặc định là `user`; admin tạo bằng seed script.
- [ ] Có middleware RBAC tái sử dụng.
- [ ] Không lưu hoặc trả password plaintext.
- [ ] Tất cả lỗi theo `{ message, error, statusCode }`.
- [ ] QA end-to-end đạt.
- [ ] README và `.env.example` hoàn chỉnh.
- [ ] Deploy Render hoạt động với MongoDB production.