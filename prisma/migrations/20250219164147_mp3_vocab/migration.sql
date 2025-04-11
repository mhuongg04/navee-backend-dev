/*
  Warnings:

  - Added the required column `mp3` to the `Vocab` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Vocab" ADD COLUMN     "mp3" TEXT NOT NULL;
