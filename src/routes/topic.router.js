const { Router } = require('express');
const TopicController = require('../controllers/topicController');

const topicRouter = Router();

topicRouter.get('/topics/all', TopicController.getAllTopic);
topicRouter.get('/:topic_id', TopicController.getTopicById);
topicRouter.post('/upload', TopicController.createTopic);
topicRouter.delete('/:topic_id', TopicController.deleteTopic);
topicRouter.post('/edit/:topic_id', TopicController.editTopic);
topicRouter.get('/topics/searchbylevel', TopicController.getTopicByLevel);
topicRouter.get('/topics/searchbyname', TopicController.getTopicByName);


topicRouter.get('/:topic_id/lessons', TopicController.getLessonByTopicId);
topicRouter.get('/lesson/findnamebyID/:lesson_id', TopicController.getLessonNameById);
topicRouter.post(`/lesson`, TopicController.createLesson);
topicRouter.get('/lessons/all', TopicController.getAllLesson);
topicRouter.get('/lesson/:lesson_id', TopicController.getLesson);
topicRouter.delete('/lesson/:lesson_id', TopicController.deleteLesson);
topicRouter.post('/edit/lesson/:lesson_id', TopicController.editLesson);


module.exports = topicRouter;