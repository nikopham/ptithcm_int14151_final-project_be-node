/*
  Warnings:

  - The values [single,series] on the enum `MovieType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "MovieType_new" AS ENUM ('movie', 'tv');
ALTER TABLE "Movie" ALTER COLUMN "type" TYPE "MovieType_new" USING ("type"::text::"MovieType_new");
ALTER TYPE "MovieType" RENAME TO "MovieType_old";
ALTER TYPE "MovieType_new" RENAME TO "MovieType";
DROP TYPE "public"."MovieType_old";
COMMIT;
