-- CreateTable
CREATE TABLE "LinkPreview" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "urlHash" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "siteName" TEXT,
    "imageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkPreview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LinkPreview_urlHash_key" ON "LinkPreview"("urlHash");

-- CreateIndex
CREATE INDEX "LinkPreview_fetchedAt_idx" ON "LinkPreview"("fetchedAt");
