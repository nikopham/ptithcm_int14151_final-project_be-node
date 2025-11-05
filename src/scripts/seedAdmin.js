require("dotenv").config();
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const email = "pham5446@gmail.com";
  const password = "123456Aa@";
  const roleName = "admin";

  // Tạo hoặc tìm role 'admin'
  const role = await prisma.role.upsert({
    where: { name: roleName },
    update: {},
    create: { name: roleName },
  });

  // Hash mật khẩu
  const hashedPassword = await bcrypt.hash(password, 10);

  // Tạo account admin
  const admin = await prisma.account.upsert({
    where: { email },
    update: {},
    create: {
      email,
      password: hashedPassword,
      full_name: "Administrator",
      role_id: role.id,
    },
  });

  console.log("✅ Seeded admin account:");
  console.log(`Email: ${admin.email}`);
  console.log(`Password: ${password}`);
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
