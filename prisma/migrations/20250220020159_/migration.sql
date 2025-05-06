-- DropForeignKey
ALTER TABLE "Vocab" DROP CONSTRAINT "Vocab_lesson_id_fkey";

-- AddForeignKey
ALTER TABLE "Vocab" ADD CONSTRAINT "Vocab_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
