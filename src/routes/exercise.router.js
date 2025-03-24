const { Router } = require('express');
const ExerciseController = require('../controllers/exerciseController');
const authenticateUser = require('../middlewares/authentication.middleware');

const exRouter = Router();

exRouter.post('/submit', authenticateUser, ExerciseController.submitExercise);
exRouter.get('/results/:lessonId', authenticateUser, ExerciseController.getUserExerciseResults);

exRouter.get('/exercises/all', ExerciseController.getAllExercise);
exRouter.get('/:lesson_id/exercise', ExerciseController.getExerciseByLessonId);
exRouter.post('/:lesson_id/upload-ex', ExerciseController.createExercise);

module.exports = exRouter