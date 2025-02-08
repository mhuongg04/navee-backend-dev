//const { request, response } = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const AuthController = {
    async signup(request, response) {
        const { firstname, lastname, email, password, role } = request.body;
        try {
            // Kiểm tra xem email đã tồn tại trong cơ sở dữ liệu chưa
            const existingUser = await prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                return response.status(400).json({ error: 'Email đã tồn tại' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            const newUser = await prisma.user.create({
                data: {
                    firstname,
                    lastname,
                    email,
                    password: hashedPassword,
                    role,
                    earnpoints: 0,
                }
            });

            console.log(newUser.firstname, newUser.lastname, newUser.email, newUser.password)

            response.status(201).json({
                id: newUser.id,
                firstname: newUser.firstname,
                lastname: newUser.lastname,
                email: newUser.email,
                role: newUser.role,
                earnpoints: newUser.earnpoints,
            });
        } catch (error) {
            console.log(error);
            response.status(400).json({ error: "Signup failed!" })
        }
    },

    async login(request, response) {
        const { email, password } = request.body;
        try {
            // Kiểm tra xem email đã tồn tại trong cơ sở dữ liệu chưa
            const user = await prisma.user.findUnique({
                where: {
                    email: email,
                },
            });
            if (!user) {
                return response
                    .status(501)
                    .json({ message: "User not found" });

            }

            const match = await bcrypt.compare(password, user.password);

            if (!match) {
                return response
                    .status(300)
                    .json({ message: "Invalid password" })
            }

            const secret = process.env.JWT_SECRET;
            const userId = user.id;
            const token = jwt.sign({ userId: userId }, secret, {
                expiresIn: "24h",
            });

            return response.status(201).json({
                message: "Login successfully!",
                accessToken: token,
            });
        }
        catch (error) {
            console.log(error);
            response.status(400).json({ error: "Login failed!" })
        }
    }
};

module.exports = AuthController;


