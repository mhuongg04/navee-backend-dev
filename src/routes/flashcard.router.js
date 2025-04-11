const { Router } = require('express');
const FlashcardController = require('../controllers/flashcardController');
const authenticateUser = require('../middlewares/authentication.middleware');

const fcRouter = Router();

fcRouter.get('/vocab/all', FlashcardController.getAllVocab);
fcRouter.get('/vocab/:lesson_id', FlashcardController.getVocabByLessonId);
fcRouter.post('/upload/vocab', FlashcardController.createVocab);
fcRouter.post('/edit/vocab/:vocab_id', FlashcardController.editVocab);
fcRouter.delete('/delete/vocab/:vocab_id', FlashcardController.deleteVocab);

//user
fcRouter.get('/flashcard/all', FlashcardController.getAllFlashcard);
fcRouter.get('/flashcard/my', authenticateUser, FlashcardController.getMyFlashcard);
fcRouter.get('/flashcard/:flashcardId', FlashcardController.getFlashcardData);
fcRouter.post('/flashcard/user/create', authenticateUser, FlashcardController.createMyFlashcard);
fcRouter.post('/flashcard/:fc_id', FlashcardController.addVocabToFlashcard);
fcRouter.delete('/flashcard/:fc_id/delete', FlashcardController.deleteFlashcard);
fcRouter.post('/editflashcard/:flashcard_id', FlashcardController.editFlashcard);

//admin
fcRouter.post('/flashcard/admin/create', authenticateUser, FlashcardController.adminCreateFlashcard);


module.exports = fcRouter;