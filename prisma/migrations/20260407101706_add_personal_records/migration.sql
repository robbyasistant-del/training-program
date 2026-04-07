-- CreateEnum
CREATE TYPE "StandardDistanceLabel" AS ENUM ('FIVE_K', 'TEN_K', 'FIFTEEN_K', 'HALF_MARATHON', 'MARATHON');

-- CreateTable
CREATE TABLE "PersonalRecord" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "distanceLabel" "StandardDistanceLabel" NOT NULL,
    "distanceMeters" DOUBLE PRECISION NOT NULL,
    "timeSeconds" INTEGER NOT NULL,
    "pacePerKm" DOUBLE PRECISION NOT NULL,
    "activityId" TEXT NOT NULL,
    "achievedAt" TIMESTAMP(3) NOT NULL,
    "previousRecordId" TEXT,
    "improvementSeconds" INTEGER,
    "isCurrentRecord" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonalRecord_athleteId_distanceLabel_idx" ON "PersonalRecord"("athleteId", "distanceLabel");

-- CreateIndex
CREATE INDEX "PersonalRecord_athleteId_isCurrentRecord_idx" ON "PersonalRecord"("athleteId", "isCurrentRecord");

-- CreateIndex
CREATE INDEX "PersonalRecord_activityId_idx" ON "PersonalRecord"("activityId");

-- AddForeignKey
ALTER TABLE "PersonalRecord" ADD CONSTRAINT "PersonalRecord_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalRecord" ADD CONSTRAINT "PersonalRecord_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalRecord" ADD CONSTRAINT "PersonalRecord_previousRecordId_fkey" FOREIGN KEY ("previousRecordId") REFERENCES "PersonalRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
