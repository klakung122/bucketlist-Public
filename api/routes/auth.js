import { Router } from "express";
import pool from "../db.js";
import bcrypt from "bcryptjs";
import { z } from "zod";
import jwt from "jsonwebtoken";
import cookie from "cookie";

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

export default router;