const jwt = require('jsonwebtoken');

const authenticateUser = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            console.error("No token provided");
            return res.status(401).json({ error: "Unauthorized: No token provided" });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded || !decoded.userId) {
            console.error("Invalid token structure");
            return res.status(401).json({ error: "Unauthorized: Invalid token structure" });
        }

        req.user = { id: decoded.userId }; // ✅ Gán vào req.user
        next();
    } catch (error) {
        console.error("Authentication error:", error.message);
        return res.status(403).json({ error: "Forbidden: Token verification failed" });
    }
};

module.exports = authenticateUser;