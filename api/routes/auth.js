import { Router } from "express";
import pool from "../db.js";
import bcrypt from "bcryptjs";
import { z } from "zod";
import jwt from "jsonwebtoken";
import cookie from "cookie";
import { requireAuth } from "../middlewares/requireAuth.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

const registerSchema = z.object({
    username: z
        .string()
        .min(3, "ชื่อผู้ใช้อย่างน้อย 3 ตัว")
        .max(50, "ชื่อผู้ใช้ยาวเกินกำหนด")
        .regex(/^[a-zA-Z0-9._-]+$/, "ใช้ได้เฉพาะ a-z, 0-9, . _ -"),
    email: z.string().email("อีเมลไม่ถูกต้อง").max(255),
    password: z.string().min(8, "รหัสผ่านอย่างน้อย 8 ตัว"),
});

router.post("/register", async (req, res) => {
    try {
        const parse = registerSchema.safeParse(req.body);
        if (!parse.success) {
            const msg = parse.error.issues?.[0]?.message || "ข้อมูลไม่ถูกต้อง";
            return res.status(400).json({ message: msg });
        }

        const { username, email, password } = parse.data;

        // hash password
        const rounds = Number(process.env.BCRYPT_ROUNDS || 12);
        const hash = await bcrypt.hash(password, rounds);

        const sql =
            "INSERT INTO users (username, email, password, profile_image) VALUES (?, ?, ?, NULL)";
        const params = [username.trim(), email.trim().toLowerCase(), hash];

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.execute(sql, params);
            // ส่งคืนเฉพาะข้อมูลจำเป็น
            return res.status(201).json({
                message: "registered",
                user: { id: result.insertId, username, email: email.toLowerCase() },
            });
        } finally {
            conn.release();
        }
    } catch (err) {
        // จัดการกรณีซ้ำ (unique key)
        if (err && err.code === "ER_DUP_ENTRY") {
            // ข้อความ error ของ MySQL จะบอกคีย์ที่ชน เช่น uq_users_email / uq_users_username
            const msg = err.message?.includes("username")
                ? "ชื่อผู้ใช้ถูกใช้แล้ว"
                : err.message?.includes("email")
                    ? "อีเมลถูกใช้แล้ว"
                    : "ข้อมูลซ้ำ";
            return res.status(409).json({ message: msg });
        }

        console.error("REGISTER_ERROR:", err);
        return res.status(500).json({ message: "เกิดข้อผิดพลาดภายในระบบ" });
    }
});

router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password)
            return res.status(400).json({ message: "กรอกข้อมูลไม่ครบ" });

        const conn = await pool.getConnection();
        const [rows] = await conn.execute("SELECT * FROM users WHERE username = ?", [
            username.trim(),
        ]);
        conn.release();

        if (rows.length === 0) {
            return res.status(401).json({ message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
        }

        const user = rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
        }

        // สร้าง JWT
        const token = jwt.sign(
            { id: user.id, username: user.username },
            process.env.JWT_SECRET || "changeme",
            { expiresIn: "7d" }
        );

        // ส่งกลับพร้อม cookie (DEV)
        const setCookie = cookie.serialize("token", token, {
            httpOnly: true,
            sameSite: "lax",
            secure: false,   // dev: http
            path: "/",
            // ห้ามตั้ง domain ตอน dev
            maxAge: 60 * 60 * 24 * 7,
        });

        res.setHeader("Set-Cookie", setCookie);   // <-- ต้องมีบรรทัดนี้
        return res.json({ message: "logged in", user: { id: user.id, username: user.username } });
    } catch (err) {
        console.error("LOGIN_ERROR:", err);
        res.status(500).json({ message: "เกิดข้อผิดพลาด" });
    }
});

router.get("/me", async (req, res) => {
    try {
        const cookies = cookie.parse(req.headers.cookie || "");
        const token = cookies.token;
        if (!token) return res.status(401).json({ message: "ไม่ได้เข้าสู่ระบบ" });

        const payload = jwt.verify(token, process.env.JWT_SECRET || "changeme");
        const conn = await pool.getConnection();
        const [rows] = await conn.execute(
            "SELECT id, username, email, profile_image FROM users WHERE id = ?",
            [payload.id]
        );
        conn.release();

        if (!rows.length) return res.status(401).json({ message: "ไม่พบบัญชี" });

        res.json({ user: rows[0] });
    } catch (err) {
        return res.status(401).json({ message: "token ไม่ถูกต้อง" });
    }
});

router.post("/logout", (req, res) => {
    const isProd = process.env.NODE_ENV === "production";

    res.setHeader("Set-Cookie",
        cookie.serialize("token", "", {
            httpOnly: true,
            secure: isProd,
            sameSite: "lax",
            path: "/",
            domain: isProd ? process.env.COOKIE_DOMAIN : undefined,
            maxAge: 0,                  // หมดอายุทันที
            expires: new Date(0),       // กันพลาด
        })
    );

    res.json({ message: "logged out" });
});

router.post("/change-password", requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body || {};
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
        }

        const conn = await pool.getConnection();
        try {
            const [[user]] = await conn.query("SELECT id, password FROM users WHERE id = ? LIMIT 1", [req.user.id]);
            if (!user) return res.status(401).json({ message: "ไม่พบบัญชี" });

            const ok = await bcrypt.compare(currentPassword, user.password);
            if (!ok) return res.status(400).json({ message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" });

            if (newPassword.length < 8) return res.status(400).json({ message: "รหัสผ่านใหม่อย่างน้อย 8 ตัว" });

            const rounds = Number(process.env.BCRYPT_ROUNDS || 12);
            const hash = await bcrypt.hash(newPassword, rounds);

            await conn.query("UPDATE users SET password = ? WHERE id = ?", [hash, req.user.id]);
            res.json({ message: "changed" });
        } finally {
            conn.release();
        }
    } catch (e) {
        console.error("CHANGE_PASSWORD_ERROR:", e);
        res.status(500).json({ message: "เกิดข้อผิดพลาด" });
    }
});

const uploadDir = path.join(process.cwd(), "uploads", "avatars");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `u${req.user.id}_${Date.now()}${ext}`);
    },
});
const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) return cb(new Error("ไฟล์ต้องเป็นรูปภาพ"));
        cb(null, true);
    },
});

// helper กันพลาด: ลบเฉพาะไฟล์ใน uploads/avatars เท่านั้น
function safeUnlinkAvatar(relOrAbsPath) {
    try {
        if (!relOrAbsPath) return;
        // รับได้ทั้ง "/uploads/avatars/xxx.jpg" หรือ absolute (เผื่อกรณี dev ลองผิด)
        const rel = relOrAbsPath.startsWith("/uploads/")
            ? relOrAbsPath
            : relOrAbsPath.replace(/^.*\/uploads\//, "/uploads/");

        if (!rel.startsWith("/uploads/avatars/")) return; // ปลอดภัย: ไม่ใช่โฟลเดอร์นี้ไม่ลบ

        const abs = path.resolve(process.cwd(), "." + rel); // "/uploads/..." → "<project>/uploads/..."
        // ย้ำความปลอดภัย: ต้องอยู่ใต้ uploadDir เท่านั้น
        if (!abs.startsWith(uploadDir)) return;

        fs.unlink(abs, (err) => {
            if (err && err.code !== "ENOENT") {
                console.warn("UNLINK_OLD_AVATAR_FAIL:", err.message);
            }
        });
    } catch (e) {
        console.warn("SAFE_UNLINK_GUARD_FAIL:", e.message);
    }
}

router.post("/avatar", requireAuth, upload.single("avatar"), async (req, res) => {
    const base = process.env.PUBLIC_BASE_URL || "http://localhost:4000";

    if (!req.file) {
        return res.status(400).json({ message: "ไม่มีไฟล์อัปโหลด" });
    }

    const newRelPath = `/uploads/avatars/${req.file.filename}`;

    const conn = await pool.getConnection();
    try {
        // 1) อ่านรูปเดิม
        const [[user]] = await conn.query(
            "SELECT id, profile_image FROM users WHERE id = ? LIMIT 1",
            [req.user.id]
        );
        const oldPath = user?.profile_image || null;

        // 2) อัปเดตเป็นรูปใหม่
        await conn.query("UPDATE users SET profile_image = ? WHERE id = ?", [
            newRelPath,
            req.user.id,
        ]);

        // 3) ลบไฟล์เก่า (เฉพาะของเราเท่านั้น)
        if (oldPath && oldPath !== newRelPath) {
            safeUnlinkAvatar(oldPath);
        }

        // ส่ง URL เต็ม + cache bust
        return res.json({ url: `${base}${newRelPath}?t=${Date.now()}` });
    } catch (e) {
        console.error("AVATAR_UPLOAD_ERROR:", e);
        return res.status(500).json({ message: "อัปโหลดไม่สำเร็จ" });
    } finally {
        conn.release();
    }
});

export default router;