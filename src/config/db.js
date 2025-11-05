const { PrismaClient } = require("@prisma/client");

const globalForPrisma = global;

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
   
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}


const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log("✅ PostgreSQL connected with Prisma");
  } catch (err) {
    console.error("❌ PostgreSQL connection error with Prisma:", err);
    process.exit(1);
  }
};

module.exports = { prisma, connectDB };
