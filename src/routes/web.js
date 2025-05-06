const express = require('express');
const authRouter = require('./auth.router');
const topicRouter = require('./topic.router');
const exRouter = require('./exercise.router');
const fcRouter = require('./flashcard.router');
const enrollmentRouter = require('./enrollment.router');
const testRouter = require('./test.router');
const apiRouter = express.Router();

apiRouter.use('/api', authRouter); 
apiRouter.use('/api', topicRouter);
apiRouter.use('/api', exRouter);
apiRouter.use('/api', enrollmentRouter);
apiRouter.use('/api', testRouter);
apiRouter.use('/api', fcRouter);


module.exports = apiRouter;