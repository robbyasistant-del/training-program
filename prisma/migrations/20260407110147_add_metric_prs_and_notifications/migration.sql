-- CreateEnum
CREATE TYPE "MetricType" AS ENUM ('DISTANCE', 'PACE', 'DURATION', 'ELEVATION_GAIN');

-- CreateTable
CREATE TABLE "MetricPR" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "activityType" "ActivityType" NOT NULL,
    "metricType" "MetricType" NOT NULL,
    "metricValue" DOUBLE PRECISION NOT NULL,
    "recordDate" TIMESTAMP(3) NOT NULL,
    "previousRecordId" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "improvementPercent" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetricPR_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PRNotification" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "metricType" "MetricType" NOT NULL,
    "seen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PRNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetricPR_athleteId_activityType_metricType_idx" ON "MetricPR"("athleteId", "activityType", "metricType");

-- CreateIndex
CREATE INDEX "MetricPR_athleteId_isCurrent_idx" ON "MetricPR"("athleteId", "isCurrent");

-- CreateIndex
CREATE INDEX "MetricPR_activityId_idx" ON "MetricPR"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "MetricPR_athleteId_activityType_metricType_recordDate_key" ON "MetricPR"("athleteId", "activityType", "metricType", "recordDate");

-- CreateIndex
CREATE INDEX "PRNotification_athleteId_idx" ON "PRNotification"("athleteId");

-- CreateIndex
CREATE INDEX "PRNotification_seen_idx" ON "PRNotification"("seen");

-- CreateIndex
CREATE INDEX "PRNotification_createdAt_idx" ON "PRNotification"("createdAt");

-- AddForeignKey
ALTER TABLE "MetricPR" ADD CONSTRAINT "MetricPR_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricPR" ADD CONSTRAINT "MetricPR_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricPR" ADD CONSTRAINT "MetricPR_previousRecordId_fkey" FOREIGN KEY ("previousRecordId") REFERENCES "MetricPR"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PRNotification" ADD CONSTRAINT "PRNotification_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
