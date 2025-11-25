
-- CreateTable
CREATE TABLE "user_commenter_stats" (
    "id" TEXT NOT NULL,
    "postAuthorId" TEXT NOT NULL,
    "commenterId" TEXT NOT NULL,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "lastCommentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_commenter_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_commenter_stats_postAuthorId_idx" ON "user_commenter_stats"("postAuthorId");

-- CreateIndex
CREATE INDEX "user_commenter_stats_commenterId_idx" ON "user_commenter_stats"("commenterId");

-- CreateIndex
CREATE UNIQUE INDEX "user_commenter_stats_postAuthorId_commenterId_key" ON "user_commenter_stats"("postAuthorId", "commenterId");

-- AddForeignKey
ALTER TABLE "user_commenter_stats" ADD CONSTRAINT "user_commenter_stats_postAuthorId_fkey" FOREIGN KEY ("postAuthorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_commenter_stats" ADD CONSTRAINT "user_commenter_stats_commenterId_fkey" FOREIGN KEY ("commenterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
