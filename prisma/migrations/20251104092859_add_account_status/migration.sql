-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('active', 'inactive');

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "status" "AccountStatus" NOT NULL DEFAULT 'active';
