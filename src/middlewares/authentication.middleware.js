const jwt = require('jsonwebtoken');

const authenticateUser = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        console.log("🔍 Received Authorization Header:", authHeader);

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            console.error("No token provided");
            return res.status(401).json({ error: "Unauthorized: No token provided" });
        }

        const token = authHeader.split(" ")[1];
        console.log("🔍 Extracted Token:", token);

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log("Decoded Token:", decoded);

        if (!decoded || !decoded.userId) {
            console.error("Invalid token structure");
            return res.status(401).json({ error: "Unauthorized: Invalid token structure" });
        }

        res.locals.user = { id: decoded.userId };
        next();
    } catch (error) {
        console.error("Authentication error:", error.message);
        return res.status(403).json({ error: "Forbidden: Token verification failed" });
    }
};

module.exports = authenticateUser;
