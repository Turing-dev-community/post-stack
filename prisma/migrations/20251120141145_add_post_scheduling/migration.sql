-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "scheduledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "posts_scheduledAt_idx" ON "posts"("scheduledAt");
