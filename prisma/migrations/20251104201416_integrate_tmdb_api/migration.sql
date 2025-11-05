/*
  Warnings:

  - A unique constraint covering the columns `[tmdb_id]` on the table `Actor` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[iso_id]` on the table `Country` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tmdb_id]` on the table `Director` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tmdb_id]` on the table `Episode` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tmdb_id]` on the table `Genre` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tmdb_id]` on the table `Movie` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "MovieStatus" AS ENUM ('published', 'pending');

-- AlterTable
ALTER TABLE "Actor" ADD COLUMN     "tmdb_id" INTEGER;

-- AlterTable
ALTER TABLE "Country" ADD COLUMN     "iso_id" VARCHAR(10);

-- AlterTable
ALTER TABLE "Director" ADD COLUMN     "tmdb_id" INTEGER;

-- AlterTable
ALTER TABLE "Episode" ADD COLUMN     "tmdb_id" INTEGER;

-- AlterTable
ALTER TABLE "Genre" ADD COLUMN     "tmdb_id" INTEGER;

-- AlterTable
ALTER TABLE "Movie" ADD COLUMN     "status" "MovieStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN     "tmdb_id" INTEGER;

-- CreateTable
CREATE TABLE "VideoSource" (
    "id" SERIAL NOT NULL,
    "episode_id" INTEGER NOT NULL,
    "video_url" VARCHAR(255) NOT NULL,
    "quality" "VideoQuality" NOT NULL,
    "label" VARCHAR(50),

    CONSTRAINT "VideoSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoSource_episode_id_idx" ON "VideoSource"("episode_id");

-- CreateIndex
CREATE UNIQUE INDEX "Actor_tmdb_id_key" ON "Actor"("tmdb_id");

-- CreateIndex
CREATE UNIQUE INDEX "Country_iso_id_key" ON "Country"("iso_id");

-- CreateIndex
CREATE UNIQUE INDEX "Director_tmdb_id_key" ON "Director"("tmdb_id");

-- CreateIndex
CREATE UNIQUE INDEX "Episode_tmdb_id_key" ON "Episode"("tmdb_id");

-- CreateIndex
CREATE UNIQUE INDEX "Genre_tmdb_id_key" ON "Genre"("tmdb_id");

-- CreateIndex
CREATE UNIQUE INDEX "Movie_tmdb_id_key" ON "Movie"("tmdb_id");

-- AddForeignKey
ALTER TABLE "VideoSource" ADD CONSTRAINT "VideoSource_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
