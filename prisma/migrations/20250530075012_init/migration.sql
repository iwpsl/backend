-- CreateEnum
CREATE TYPE "Role" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "AuthType" AS ENUM ('email', 'firebase');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female');

-- CreateEnum
CREATE TYPE "MainGoal" AS ENUM ('weightLoss', 'stayFit', 'buildMuscle');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('low', 'medium', 'high', 'veryHigh');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');

-- CreateEnum
CREATE TYPE "FastingCategory" AS ENUM ('fast16eat08', 'fast18eat06', 'fast14eat10', 'fast12eat12', 'fast13eat11', 'fast15eat09', 'custom');

-- CreateEnum
CREATE TYPE "ChallengeCategory" AS ENUM ('workout', 'food', 'fast');

-- CreateEnum
CREATE TYPE "VerificationAction" AS ENUM ('signup', 'resetPassword', 'changeEmail');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "authType" "AuthType" NOT NULL,
    "password" TEXT,
    "role" "Role" NOT NULL DEFAULT 'user',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "fcmToken" TEXT,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "mainGoal" "MainGoal" NOT NULL,
    "age" INTEGER NOT NULL,
    "heightCm" INTEGER NOT NULL,
    "weightKg" INTEGER NOT NULL,
    "weightTargetKg" INTEGER NOT NULL,
    "activityLevel" "ActivityLevel" NOT NULL,
    "avatarId" UUID,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalorieTarget" (
    "id" UUID NOT NULL,
    "energyKcal" INTEGER NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CalorieTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalorieHeader" (
    "id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "userId" UUID NOT NULL,
    "targetId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CalorieHeader_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalorieEntry" (
    "id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "food" TEXT NOT NULL,
    "portion" DOUBLE PRECISION NOT NULL,
    "mealType" "MealType" NOT NULL,
    "energyKcal" INTEGER NOT NULL,
    "proteinGr" INTEGER NOT NULL,
    "carbohydrateGr" INTEGER NOT NULL,
    "fatGr" INTEGER NOT NULL,
    "sugarGr" INTEGER NOT NULL,
    "sodiumMg" INTEGER NOT NULL,
    "userId" UUID NOT NULL,
    "headerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CalorieEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterTarget" (
    "id" UUID NOT NULL,
    "amountMl" INTEGER NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WaterTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterEntry" (
    "id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amountMl" INTEGER NOT NULL,
    "userId" UUID NOT NULL,
    "targetId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WaterEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StepTarget" (
    "id" UUID NOT NULL,
    "steps" INTEGER NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StepTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StepEntry" (
    "id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "steps" INTEGER NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "activeMinutes" INTEGER NOT NULL,
    "userId" UUID NOT NULL,
    "targetId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StepEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FastingEntry" (
    "id" UUID NOT NULL,
    "category" "FastingCategory" NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FastingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeightEntry" (
    "id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "weightKg" INTEGER NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WeightEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ChallengeCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeTask" (
    "id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "challengeId" UUID NOT NULL,

    CONSTRAINT "ChallengeTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeSubscription" (
    "id" UUID NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "challengeId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinishedChallengeTask" (
    "id" UUID NOT NULL,
    "subId" UUID NOT NULL,
    "taskId" UUID NOT NULL,

    CONSTRAINT "FinishedChallengeTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserConnection" (
    "id" UUID NOT NULL,
    "aId" UUID NOT NULL,
    "bId" UUID NOT NULL,

    CONSTRAINT "UserConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectionRequest" (
    "id" UUID NOT NULL,
    "fromId" UUID NOT NULL,
    "toId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingVerification" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "action" "VerificationAction" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeEmailVerificationAction" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "verificationId" UUID NOT NULL,

    CONSTRAINT "ChangeEmailVerificationAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_fcmToken_key" ON "User"("fcmToken");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CalorieHeader_userId_date_key" ON "CalorieHeader"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WaterEntry_userId_date_key" ON "WaterEntry"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "StepEntry_userId_date_key" ON "StepEntry"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "FinishedChallengeTask_subId_taskId_key" ON "FinishedChallengeTask"("subId", "taskId");

-- CreateIndex
CREATE UNIQUE INDEX "UserConnection_aId_bId_key" ON "UserConnection"("aId", "bId");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectionRequest_fromId_toId_key" ON "ConnectionRequest"("fromId", "toId");

-- CreateIndex
CREATE UNIQUE INDEX "PendingVerification_email_key" ON "PendingVerification"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ChangeEmailVerificationAction_verificationId_key" ON "ChangeEmailVerificationAction"("verificationId");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalorieTarget" ADD CONSTRAINT "CalorieTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalorieHeader" ADD CONSTRAINT "CalorieHeader_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalorieHeader" ADD CONSTRAINT "CalorieHeader_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "CalorieTarget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalorieEntry" ADD CONSTRAINT "CalorieEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalorieEntry" ADD CONSTRAINT "CalorieEntry_headerId_fkey" FOREIGN KEY ("headerId") REFERENCES "CalorieHeader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterTarget" ADD CONSTRAINT "WaterTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterEntry" ADD CONSTRAINT "WaterEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterEntry" ADD CONSTRAINT "WaterEntry_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "WaterTarget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepTarget" ADD CONSTRAINT "StepTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepEntry" ADD CONSTRAINT "StepEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepEntry" ADD CONSTRAINT "StepEntry_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "StepTarget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FastingEntry" ADD CONSTRAINT "FastingEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeightEntry" ADD CONSTRAINT "WeightEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeTask" ADD CONSTRAINT "ChallengeTask_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeSubscription" ADD CONSTRAINT "ChallengeSubscription_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeSubscription" ADD CONSTRAINT "ChallengeSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishedChallengeTask" ADD CONSTRAINT "FinishedChallengeTask_subId_fkey" FOREIGN KEY ("subId") REFERENCES "ChallengeSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishedChallengeTask" ADD CONSTRAINT "FinishedChallengeTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ChallengeTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserConnection" ADD CONSTRAINT "UserConnection_aId_fkey" FOREIGN KEY ("aId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserConnection" ADD CONSTRAINT "UserConnection_bId_fkey" FOREIGN KEY ("bId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionRequest" ADD CONSTRAINT "ConnectionRequest_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionRequest" ADD CONSTRAINT "ConnectionRequest_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeEmailVerificationAction" ADD CONSTRAINT "ChangeEmailVerificationAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeEmailVerificationAction" ADD CONSTRAINT "ChangeEmailVerificationAction_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "PendingVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
