-- CreateTable
CREATE TABLE "DiferenciasPushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiferenciasPushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiferenciasPushSubscription_endpoint_key" ON "DiferenciasPushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "DiferenciasPushSubscription_userId_idx" ON "DiferenciasPushSubscription"("userId");

-- AddForeignKey
ALTER TABLE "DiferenciasPushSubscription" ADD CONSTRAINT "DiferenciasPushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "DiferenciasUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
