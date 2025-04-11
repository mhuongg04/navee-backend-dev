const { Router } = require('express');
const TopicController = require('../controllers/topicController');

const topicRouter = Router();

topicRouter.get('/topics/all', TopicController.getAllTopic);
topicRouter.get('/:topic_id', TopicController.getTopicById);
topicRouter.post('/upload', TopicController.createTopic);
topicRouter.get('/:topic_id/lessons', TopicController.getLessonByTopicId);
topicRouter.post(`/lesson`, TopicController.createLesson);
topicRouter.get('/lessons/all', TopicController.getAllLesson);
topicRouter.get('/lesson/:lesson_id', TopicController.getLesson);

module.exports = topicRouter;