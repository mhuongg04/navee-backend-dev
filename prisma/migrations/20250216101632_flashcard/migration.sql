-- CreateTable
CREATE TABLE "Flashcard" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT,

    CONSTRAINT "Flashcard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FcVocab" (
    "id" TEXT NOT NULL,
    "vocab_id" TEXT NOT NULL,
    "fc_id" TEXT NOT NULL,

    CONSTRAINT "FcVocab_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FcVocab" ADD CONSTRAINT "FcVocab_vocab_id_fkey" FOREIGN KEY ("vocab_id") REFERENCES "Vocab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FcVocab" ADD CONSTRAINT "FcVocab_fc_id_fkey" FOREIGN KEY ("fc_id") REFERENCES "Flashcard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
