/*
  Warnings:

  - You are about to drop the column `data` on the `Activity` table. All the data in the column will be lost.
  - You are about to drop the column `duration` on the `Activity` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Athlete` table. All the data in the column will be lost.
  - Added the required column `name` to the `Activity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `stravaActivityId` to the `Activity` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `Activity` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `firstname` to the `Athlete` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastname` to the `Athlete` table without a default value. This is not possible if the table is not empty.
  - Added the required column `stravaId` to the `Athlete` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('RUN', 'RIDE', 'SWIM', 'HIKE', 'WALK', 'ALPINE_SKI', 'BACKCOUNTRY_SKI', 'CANOEING', 'CROSSFIT', 'E_BIKE_RIDE', 'ELLIPTICAL', 'GOLF', 'HANDCYCLE', 'ICE_SKATE', 'INLINE_SKATE', 'KAYAKING', 'KITESURF', 'NORDIC_SKI', 'ROCK_CLIMBING', 'ROLLER_SKI', 'ROWING', 'SAIL', 'SKATEBOARD', 'SNOWBOARD', 'SNOWSHOE', 'SOCCER', 'STAIRSTEPPER', 'STAND_UP_PADDLING', 'SURFING', 'VELOMOBILE', 'VIRTUAL_RIDE', 'VIRTUAL_RUN', 'WEIGHT_TRAINING', 'WHEELCHAIR', 'WINDSURF', 'WORKOUT', 'YOGA');

-- DropForeignKey
ALTER TABLE "Activity" DROP CONSTRAINT "Activity_athleteId_fkey";

-- AlterTable
ALTER TABLE "Activity" DROP COLUMN "data",
DROP COLUMN "duration",
ADD COLUMN     "averageHeartrate" DOUBLE PRECISION,
ADD COLUMN     "averageSpeed" DOUBLE PRECISION,
ADD COLUMN     "elapsedTime" INTEGER,
ADD COLUMN     "maxHeartrate" DOUBLE PRECISION,
ADD COLUMN     "maxSpeed" DOUBLE PRECISION,
ADD COLUMN     "movingTime" INTEGER,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "totalElevationGain" DOUBLE PRECISION,
ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
DROP COLUMN "stravaActivityId",
ADD COLUMN     "stravaActivityId" BIGINT NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" "ActivityType" NOT NULL;

-- AlterTable
ALTER TABLE "Athlete" DROP COLUMN "name",
ADD COLUMN     "firstname" TEXT NOT NULL,
ADD COLUMN     "lastname" TEXT NOT NULL,
ADD COLUMN     "profileImage" TEXT,
ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
DROP COLUMN "stravaId",
ADD COLUMN     "stravaId" BIGINT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Activity_stravaActivityId_key" ON "Activity"("stravaActivityId");

-- CreateIndex
CREATE INDEX "Activity_type_idx" ON "Activity"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Athlete_stravaId_key" ON "Athlete"("stravaId");

-- CreateIndex
CREATE INDEX "Athlete_stravaId_idx" ON "Athlete"("stravaId");

-- CreateIndex
CREATE INDEX "Athlete_email_idx" ON "Athlete"("email");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
