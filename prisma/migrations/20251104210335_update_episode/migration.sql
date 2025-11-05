/*
  Warnings:

  - You are about to drop the column `quality` on the `Episode` table. All the data in the column will be lost.
  - You are about to drop the column `video_url` on the `Episode` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Episode" DROP COLUMN "quality",
DROP COLUMN "video_url";
