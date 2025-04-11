const express = require('express');
const authRouter = require('./auth.router');
const topicRouter = require('./topic.router');
const exRouter = require('./exercise.router');

const apiRouter = express.Router();

apiRouter.use('/api', authRouter)
apiRouter.use('/api', topicRouter)
apiRouter.use('/api', exRouter)

module.exports = apiRouter;