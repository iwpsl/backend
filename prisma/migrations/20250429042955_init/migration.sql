-- CreateEnum
CREATE TYPE "Role" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "AuthType" AS ENUM ('email', 'firebase');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');

-- CreateEnum
CREATE TYPE "FastingCategory" AS ENUM ('fast16eat08', 'fast18eat06', 'fast14eat10', 'fast12eat12', 'fast13eat11', 'fast15eat09', 'custom');

-- CreateEnum
CREATE TYPE "VerificationAction" AS ENUM ('signup', 'resetPassword');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "authType" "AuthType" NOT NULL,
    "password" TEXT,
    "role" "Role" NOT NULL DEFAULT 'user',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "heightCm" INTEGER NOT NULL,
    "weightKg" INTEGER NOT NULL,
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
    "distanceKm" DOUBLE PRECISION NOT NULL,
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
CREATE TABLE "PendingVerification" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "action" "VerificationAction" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CalorieHeader_userId_date_key" ON "CalorieHeader"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WaterEntry_userId_date_key" ON "WaterEntry"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "StepEntry_userId_date_key" ON "StepEntry"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PendingVerification_email_key" ON "PendingVerification"("email");

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
