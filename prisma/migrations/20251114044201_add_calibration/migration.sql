-- CreateTable
CREATE TABLE "calibrations" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "containerId" TEXT NOT NULL,
    "hiveNumber" INTEGER NOT NULL,
    "tempExternalOffset" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tempExternalVisualized" DOUBLE PRECISION,
    "tempExternalReal" DOUBLE PRECISION,
    "tempInternalOffset" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tempInternalVisualized" DOUBLE PRECISION,
    "tempInternalReal" DOUBLE PRECISION,
    "humidityOffset" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "humidityVisualized" DOUBLE PRECISION,
    "humidityReal" DOUBLE PRECISION,
    "weightOffset" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weightVisualized" DOUBLE PRECISION,
    "weightReal" DOUBLE PRECISION,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calibrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calibrations_userId_containerId_idx" ON "calibrations"("userId", "containerId");

-- CreateIndex
CREATE INDEX "calibrations_containerId_idx" ON "calibrations"("containerId");

-- CreateIndex
CREATE UNIQUE INDEX "calibrations_userId_containerId_hiveNumber_key" ON "calibrations"("userId", "containerId", "hiveNumber");

-- AddForeignKey
ALTER TABLE "calibrations" ADD CONSTRAINT "calibrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
