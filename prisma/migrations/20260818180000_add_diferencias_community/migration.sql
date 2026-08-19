-- CreateTable
CREATE TABLE "DiferenciasUser" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "avatarKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiferenciasUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiferenciasSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiferenciasSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiferenciasPost" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiferenciasPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiferenciasComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentId" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiferenciasComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiferenciasLoginAttempt" (
    "id" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiferenciasLoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiferenciasUser_username_key" ON "DiferenciasUser"("username");
CREATE UNIQUE INDEX "DiferenciasSession_tokenHash_key" ON "DiferenciasSession"("tokenHash");
CREATE INDEX "DiferenciasSession_userId_idx" ON "DiferenciasSession"("userId");
CREATE INDEX "DiferenciasSession_expiresAt_idx" ON "DiferenciasSession"("expiresAt");
CREATE INDEX "DiferenciasPost_createdAt_idx" ON "DiferenciasPost"("createdAt");
CREATE INDEX "DiferenciasPost_authorId_createdAt_idx" ON "DiferenciasPost"("authorId", "createdAt");
CREATE INDEX "DiferenciasComment_postId_createdAt_idx" ON "DiferenciasComment"("postId", "createdAt");
CREATE INDEX "DiferenciasComment_parentId_createdAt_idx" ON "DiferenciasComment"("parentId", "createdAt");
CREATE INDEX "DiferenciasComment_authorId_idx" ON "DiferenciasComment"("authorId");
CREATE INDEX "DiferenciasLoginAttempt_keyHash_attemptedAt_idx" ON "DiferenciasLoginAttempt"("keyHash", "attemptedAt");
CREATE INDEX "DiferenciasLoginAttempt_attemptedAt_idx" ON "DiferenciasLoginAttempt"("attemptedAt");

-- AddForeignKey
ALTER TABLE "DiferenciasSession" ADD CONSTRAINT "DiferenciasSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "DiferenciasUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiferenciasPost" ADD CONSTRAINT "DiferenciasPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "DiferenciasUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiferenciasComment" ADD CONSTRAINT "DiferenciasComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "DiferenciasPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiferenciasComment" ADD CONSTRAINT "DiferenciasComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "DiferenciasUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiferenciasComment" ADD CONSTRAINT "DiferenciasComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DiferenciasComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
