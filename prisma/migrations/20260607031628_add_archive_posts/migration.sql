-- CreateTable
CREATE TABLE "ArchivePost" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArchivePost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchiveImage" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchiveImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArchivePost_createdAt_idx" ON "ArchivePost"("createdAt");

-- CreateIndex
CREATE INDEX "ArchiveImage_postId_order_idx" ON "ArchiveImage"("postId", "order");

-- AddForeignKey
ALTER TABLE "ArchiveImage" ADD CONSTRAINT "ArchiveImage_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ArchivePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
