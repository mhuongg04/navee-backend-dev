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
    },

    async getUserInfo(request, response) {
        const userId = response.locals.user.id;

        console.log(userId)

        try {
            const userInfo = await prisma.user.findUnique({
                where: { id: userId }
            });
            response.status(200).json({ user: userInfo })
        }
        catch (error) {
            response.status(500).json({ error: "Cannot get user's info" })
        }
    },
    
    // Thêm phương thức để lấy điểm của người dùng
    async getUserPoints(request, response) {
        try {
            // Kiểm tra xem user đã được xác thực chưa
            if (!response.locals.user) {
                return response.status(401).json({ message: "Người dùng chưa được xác thực" });
            }
            
            const userId = response.locals.user.id;

            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { earnpoints: true, role: true }
            });

            if (!user) {
                return response.status(404).json({ message: "Không tìm thấy người dùng" });
            }

            // Chỉ trả về điểm nếu role là user
            if (user.role !== "user") {
                return response.status(403).json({ message: "Chỉ người dùng với role 'user' mới có thể xem điểm" });
            }

            response.status(200).json({ earnpoints: user.earnpoints || 0 });
        } catch (error) {
            console.error("Error fetching user points:", error);
            response.status(500).json({ message: "Lỗi khi lấy thông tin điểm", error: error.message });
        }
    }
};

module.exports = AuthController;


