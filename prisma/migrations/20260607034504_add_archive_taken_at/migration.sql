-- AlterTable
ALTER TABLE "ArchivePost" ADD COLUMN     "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "ArchivePost_takenAt_idx" ON "ArchivePost"("takenAt");
