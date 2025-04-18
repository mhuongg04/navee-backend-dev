-- CreateEnum
CREATE TYPE "ExerciseType" AS ENUM ('fillInBlank', 'multipleChoice');

-- DropForeignKey
ALTER TABLE "Exercise" DROP CONSTRAINT "Exercise_lesson_id_fkey";

-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "exercise_type" "ExerciseType" NOT NULL DEFAULT 'fillInBlank',
ADD COLUMN     "options" TEXT[],
ADD COLUMN     "test_id" TEXT,
ALTER COLUMN "lesson_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Test" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "units" TEXT[],

    CONSTRAINT "Test_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestResult" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "total_score" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TestResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TestResult_user_id_test_id_key" ON "TestResult"("user_id", "test_id");

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "Test"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;
