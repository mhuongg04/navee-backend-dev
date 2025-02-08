const { Router } = require('express');
const TopicController = require('../controllers/topicController');

const topicRouter = Router();

topicRouter.get('/topics/all', TopicController.getAllTopic);
topicRouter.post('/upload', TopicController.createTopic);
topicRouter.get(`/lessons/:topic_id`, TopicController.getLessonByTopicId);
topicRouter.post(`/lesson`, TopicController.createLesson);

module.exports = topicRouter;