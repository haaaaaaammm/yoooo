-- Add album metadata to existing archive posts.
ALTER TABLE "ArchivePost" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'post';
ALTER TABLE "ArchivePost" ADD COLUMN "title" TEXT;
ALTER TABLE "ArchivePost" ADD COLUMN "coverImageId" TEXT;

CREATE UNIQUE INDEX "ArchivePost_coverImageId_key" ON "ArchivePost"("coverImageId");
CREATE INDEX "ArchivePost_kind_takenAt_idx" ON "ArchivePost"("kind", "takenAt");

ALTER TABLE "ArchivePost" ADD CONSTRAINT "ArchivePost_coverImageId_fkey" FOREIGN KEY ("coverImageId") REFERENCES "ArchiveImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
