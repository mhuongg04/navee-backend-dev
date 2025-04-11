const { Router } = require('express');
const ExerciseController = require('../controllers/exerciseController');

const exRouter = Router();

exRouter.get('/exercises/all', ExerciseController.getAllExercise);
exRouter.get('/:lesson_id/exercise', ExerciseController.getExerciseByLessonId);
exRouter.post('/:lesson_id/upload-ex', ExerciseController.createExercise);
exRouter.post('/edit/exercise/:ex_id', ExerciseController.editExercise);
exRouter.delete('/delete/exercise/:ex_id', ExerciseController.deleteExercise);

module.exports = exRouter