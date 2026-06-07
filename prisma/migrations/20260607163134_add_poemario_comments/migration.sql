-- CreateTable
CREATE TABLE "PoemarioComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "parentId" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PoemarioComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PoemarioComment_postId_createdAt_idx" ON "PoemarioComment"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "PoemarioComment_parentId_createdAt_idx" ON "PoemarioComment"("parentId", "createdAt");

-- AddForeignKey
ALTER TABLE "PoemarioComment" ADD CONSTRAINT "PoemarioComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoemarioComment" ADD CONSTRAINT "PoemarioComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PoemarioComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
