-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "description" TEXT,
ADD COLUMN     "ifValue" DOUBLE PRECISION,
ADD COLUMN     "normalizedPower" DOUBLE PRECISION,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'STRAVA',
ALTER COLUMN "stravaActivityId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "AthleteRecord" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "pr5km" INTEGER,
    "pr10km" INTEGER,
    "pr20km" INTEGER,
    "pr30km" INTEGER,
    "pr50km" INTEGER,
    "pr75km" INTEGER,
    "pr90km" INTEGER,
    "pr100km" INTEGER,
    "power5s" INTEGER,
    "power15s" INTEGER,
    "power30s" INTEGER,
    "power1m" INTEGER,
    "power2m" INTEGER,
    "power3m" INTEGER,
    "power5m" INTEGER,
    "power8m" INTEGER,
    "power10m" INTEGER,
    "power15m" INTEGER,
    "power20m" INTEGER,
    "power30m" INTEGER,
    "power45m" INTEGER,
    "power1h" INTEGER,
    "power2h" INTEGER,
    "estimatedFTP" INTEGER,
    "ftpMethod" TEXT,
    "totalDistance" DOUBLE PRECISION,
    "totalTime" INTEGER,
    "totalElevation" DOUBLE PRECISION,
    "totalActivities" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AthleteRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingGoal" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "elevationM" INTEGER,
    "objective" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingConversation" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Personal Trainer',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyTrainingPlan" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "title" TEXT,
    "focus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyTrainingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyTrainingDay" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "dayDate" DATE NOT NULL,
    "weekday" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetIF" DOUBLE PRECISION,
    "targetTSS" INTEGER,
    "plannedDurationMin" INTEGER,
    "workoutType" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyTrainingDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AthleteRecord_athleteId_key" ON "AthleteRecord"("athleteId");

-- CreateIndex
CREATE INDEX "AthleteRecord_athleteId_idx" ON "AthleteRecord"("athleteId");

-- CreateIndex
CREATE INDEX "AthleteRecord_updatedAt_idx" ON "AthleteRecord"("updatedAt");

-- CreateIndex
CREATE INDEX "TrainingGoal_athleteId_idx" ON "TrainingGoal"("athleteId");

-- CreateIndex
CREATE INDEX "TrainingGoal_eventDate_idx" ON "TrainingGoal"("eventDate");

-- CreateIndex
CREATE INDEX "TrainingGoal_status_idx" ON "TrainingGoal"("status");

-- CreateIndex
CREATE INDEX "TrainingConversation_athleteId_idx" ON "TrainingConversation"("athleteId");

-- CreateIndex
CREATE INDEX "TrainingConversation_updatedAt_idx" ON "TrainingConversation"("updatedAt");

-- CreateIndex
CREATE INDEX "TrainingMessage_conversationId_idx" ON "TrainingMessage"("conversationId");

-- CreateIndex
CREATE INDEX "TrainingMessage_createdAt_idx" ON "TrainingMessage"("createdAt");

-- CreateIndex
CREATE INDEX "WeeklyTrainingPlan_athleteId_idx" ON "WeeklyTrainingPlan"("athleteId");

-- CreateIndex
CREATE INDEX "WeeklyTrainingPlan_weekStart_idx" ON "WeeklyTrainingPlan"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyTrainingPlan_athleteId_weekStart_key" ON "WeeklyTrainingPlan"("athleteId", "weekStart");

-- CreateIndex
CREATE INDEX "WeeklyTrainingDay_planId_idx" ON "WeeklyTrainingDay"("planId");

-- CreateIndex
CREATE INDEX "WeeklyTrainingDay_dayDate_idx" ON "WeeklyTrainingDay"("dayDate");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyTrainingDay_planId_dayDate_key" ON "WeeklyTrainingDay"("planId", "dayDate");

-- CreateIndex
CREATE INDEX "Activity_source_idx" ON "Activity"("source");

-- AddForeignKey
ALTER TABLE "AthleteRecord" ADD CONSTRAINT "AthleteRecord_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingGoal" ADD CONSTRAINT "TrainingGoal_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingConversation" ADD CONSTRAINT "TrainingConversation_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingMessage" ADD CONSTRAINT "TrainingMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "TrainingConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyTrainingPlan" ADD CONSTRAINT "WeeklyTrainingPlan_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyTrainingDay" ADD CONSTRAINT "WeeklyTrainingDay_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WeeklyTrainingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
