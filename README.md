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

7. **API Document:**
   Link: `https://nikopham-6191851.postman.co/workspace/Niko-Pham's-Workspace~c93dd977-2eb7-4000-8313-d16e37714d6c/collection/44003931-71890a6c-9584-4ef7-be75-d1319fa8401a?action=share&creator=44003931`