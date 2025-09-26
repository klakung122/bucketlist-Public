// api/middlewares/requireAuth.js
import jwt from "jsonwebtoken";

export async function requireAuth(req, res, next) {
    try {
        const token = req.cookies?.token; // ใช้ได้เพราะมี cookieParser แล้ว
        if (!token) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

        const payload = jwt.verify(token, process.env.JWT_SECRET || "changeme");
        // แปะข้อมูลผู้ใช้ไว้ให้ตัว controller ใช้
        req.user = { id: payload.id, username: payload.username };
        next();
    } catch (e) {
        return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }
}