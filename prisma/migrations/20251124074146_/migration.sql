/*
  Warnings:

  - You are about to drop the column `scheduledAt` on the `posts` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "posts_scheduledAt_idx";

-- AlterTable
ALTER TABLE "posts" DROP COLUMN "scheduledAt";
