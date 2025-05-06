/*
  Warnings:

  - The `level` column on the `Topic` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Topic" DROP COLUMN "level",
ADD COLUMN     "level" TEXT NOT NULL DEFAULT 'beginner';

-- DropEnum
DROP TYPE "Level";
