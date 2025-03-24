const express = require('express');
const router = express.Router();
const enrollmentController = require('../controllers/enrollmentController');
const authenticateUser = require('../middlewares/authentication.middleware');


router.post('/enroll', authenticateUser, enrollmentController.enrollTopic);
router.get('/my-enrollments/:topic_id', authenticateUser, enrollmentController.getUserEnrollments);

module.exports = router;