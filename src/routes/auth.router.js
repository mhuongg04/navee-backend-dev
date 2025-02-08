const express = require('express');
const AuthController = require('../controllers/authController');

const authRouter = express.Router();

authRouter.post("/auth/login", AuthController.login);
authRouter.post("/auth/signup", AuthController.signup);

module.exports = authRouter;
