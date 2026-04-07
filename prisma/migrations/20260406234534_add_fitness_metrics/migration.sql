-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "averagePower" DOUBLE PRECISION,
ADD COLUMN     "maxPower" DOUBLE PRECISION,
ADD COLUMN     "rawJson" JSONB,
ADD COLUMN     "tss" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Athlete" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "lastSyncAt" TIMESTAMP(3),
ADD COLUMN     "sex" TEXT,
ADD COLUMN     "syncStatus" TEXT NOT NULL DEFAULT 'never',
ADD COLUMN     "weight" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "StravaConnection" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "encryptedAccessToken" BYTEA NOT NULL,
    "encryptedRefreshToken" BYTEA NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'read,activity:read',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StravaConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "currentPage" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FitnessMetric" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "ctl" DOUBLE PRECISION NOT NULL,
    "atl" DOUBLE PRECISION NOT NULL,
    "tsb" DOUBLE PRECISION NOT NULL,
    "tss" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FitnessMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StravaConnection_athleteId_key" ON "StravaConnection"("athleteId");

-- CreateIndex
CREATE INDEX "StravaConnection_athleteId_idx" ON "StravaConnection"("athleteId");

-- CreateIndex
CREATE INDEX "StravaConnection_expiresAt_idx" ON "StravaConnection"("expiresAt");

-- CreateIndex
CREATE INDEX "SyncLog_athleteId_idx" ON "SyncLog"("athleteId");

-- CreateIndex
CREATE INDEX "SyncLog_status_idx" ON "SyncLog"("status");

-- CreateIndex
CREATE INDEX "SyncLog_startedAt_idx" ON "SyncLog"("startedAt");

-- CreateIndex
CREATE INDEX "FitnessMetric_athleteId_idx" ON "FitnessMetric"("athleteId");

-- CreateIndex
CREATE INDEX "FitnessMetric_date_idx" ON "FitnessMetric"("date");

-- CreateIndex
CREATE UNIQUE INDEX "FitnessMetric_athleteId_date_key" ON "FitnessMetric"("athleteId", "date");

-- CreateIndex
CREATE INDEX "Athlete_syncStatus_idx" ON "Athlete"("syncStatus");

-- AddForeignKey
ALTER TABLE "StravaConnection" ADD CONSTRAINT "StravaConnection_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncLog" ADD CONSTRAINT "SyncLog_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitnessMetric" ADD CONSTRAINT "FitnessMetric_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
