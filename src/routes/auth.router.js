const express = require('express');
const AuthController = require('../controllers/authController');
const authenticateUser = require('../middlewares/authentication.middleware');

const authRouter = express.Router();

authRouter.post("/auth/login", AuthController.login);
authRouter.post("/auth/signup", AuthController.signup);
authRouter.get("/info", authenticateUser, AuthController.getUserInfo);

module.exports = authRouter;
