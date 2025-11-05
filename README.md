# Khởi chạy API Backend Node.js

Dịch vụ Node.js (Express) đóng vai trò là API Gateway, chịu trách nhiệm xử lý logic nghiệp vụ, xác thực người dùng, quản lý cơ sở dữ liệu (qua Prisma) và giao tiếp với các dịch vụ bên ngoài (TMDb).

## Hướng dẫn cài đặt

1. **Cài đặt PostgreSQL:**

2. **Cài đặt thư viện:**

   ```bash
   npm install
   ```

3. **Đồng bộ Cơ sở dữ liệu:**
   Lệnh này sẽ áp dụng các thay đổi trong `schema.prisma` vào CSDL của bạn.

   ```bash
   npx prisma migrate dev "init-db"
   ```

4. **Tạo Prisma Client:**
   Cập nhật client để Node.js nhận diện được các model mới.

   ```bash
   npx prisma generate
   ```

5. **Khởi chạy (Development):**

   ```bash
   npm run dev
   ```

6. **Truy cập:**
   API sẽ chạy tại: `http://localhost:5000`
