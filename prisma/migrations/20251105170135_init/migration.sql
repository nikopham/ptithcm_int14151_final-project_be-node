/*
  Warnings:

  - You are about to drop the column `movieId` on the `RefreshToken` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."RefreshToken" DROP CONSTRAINT "RefreshToken_movieId_fkey";

-- AlterTable
ALTER TABLE "RefreshToken" DROP COLUMN "movieId";
