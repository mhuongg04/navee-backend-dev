const { Router } = require('express');
const TestController = require('../controllers/testController');
const authenticateUser = require('../middlewares/authentication.middleware');

const testRouter = Router();

// API quản lý bài kiểm tra (admin/giáo viên)
testRouter.post('/test/create', TestController.createTest);
testRouter.post('/test/:test_id/add-exercises', TestController.addExercisesToTest);

// API cho học viên làm bài
testRouter.get('/unit/:unit_id/tests', authenticateUser, TestController.getTestsByUnit);
testRouter.get('/test/:test_id', TestController.getTestById);
testRouter.post('/test/:test_id/submit', authenticateUser, TestController.submitTest);
testRouter.get('/test/:test_id/result', authenticateUser, TestController.getTestResult);
testRouter.get('/user/available-tests', authenticateUser, TestController.getAvailableTestsForUser);

module.exports = testRouter; 