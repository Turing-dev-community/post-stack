-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'AUTHOR', 'EDITOR', 'ADMIN');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'AUTHOR';
