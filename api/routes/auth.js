import { Router } from "express";
import pool from "../db.js";
import bcrypt from "bcryptjs";
import { z } from "zod";
import jwt from "jsonwebtoken";
import cookie from "cookie";
import { requireAuth } from "../middlewares/requireAuth.js";
import multer from "multer";
import path from "path";
import fetch from "node-fetch";
import fs from "fs";
import sharp from "sharp";
import { getIo, userRoom, topicRoom } from "../socket.js";

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
            "SELECT id, username, email, profile_image, provider, provider_sub FROM users WHERE id = ?",
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
    const bust = Date.now();
    const fullUrl = `${base}${newRelPath}?t=${bust}`;

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

        // 4) ยิง socket หาผู้ใช้คนนี้ (ทุกอุปกรณ์/แท็บที่ล็อกอิน account เดียวกัน)
        try {
            const io = getIo();

            // ให้ตัวเองเด้งทันที
            io.to(userRoom(req.user.id)).emit("me:profile", {
                profile_image: newRelPath,
                url: fullUrl,  // มี ?t= กัน cache
                t: bust,
            });

            // ---- NEW: broadcast ให้เพื่อนในทุก topic ที่เกี่ยวข้อง ----
            try {
                // ปรับชื่อตาราง/คอลัมน์ตาม schema จริงของคุณ
                const [rows] = await conn.query(
                    `
      SELECT t.slug
      FROM topics t
      JOIN topic_members m ON m.topic_id = t.id
      WHERE m.user_id = ?
      UNION
      SELECT t2.slug
      FROM topics t2
      WHERE t2.owner_id = ?
      `,
                    [req.user.id, req.user.id]
                );

                for (const r of rows) {
                    if (!r.slug) continue;
                    io.to(topicRoom(r.slug)).emit("users:profile", {
                        slug: r.slug,
                        userId: req.user.id,
                        profile_image: newRelPath, // path ที่เก็บใน DB
                        url: fullUrl,              // URL เต็ม + cache-bust
                        t: bust,
                    });
                }
            } catch (e) {
                console.warn("broadcast users:profile failed:", e?.message);
            }
        } catch (e) {
            console.warn("emit me:profile failed:", e?.message);
        }

        // ส่งกลับให้ผู้ที่อัปโหลดด้วย
        return res.json({ url: fullUrl });
    } catch (e) {
        console.error("AVATAR_UPLOAD_ERROR:", e);
        return res.status(500).json({ message: "อัปโหลดไม่สำเร็จ" });
    } finally {
        conn.release();
    }
});

router.get("/google", (req, res) => {
    const state = crypto.randomUUID();
    // ถ้าจะป้องกัน CSRF เต็มรูปแบบ: เก็บ state ในเซสชัน/redis แล้วตรวจใน callback
    const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        response_type: "code",
        scope: "openid email profile",
        access_type: "offline",
        prompt: "consent",
        state,
    });

    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

const MAX_W = 512;
const MAX_H = 512;
const DEFAULT_QUALITY = 82;

function normalizeGooglePhotoUrl(url) {
    if (!url) return url;
    try {
        const u = new URL(url);
        if (u.searchParams.has("sz")) u.searchParams.set("sz", String(MAX_W));
        u.pathname = u.pathname.replace(/\/s\d+-c\//, `/s${MAX_W}-c/`);
        return u.toString();
    } catch { return url; }
}

async function downloadAndSaveGoogleAvatar(url, userId) {
    if (!url) return null;
    const src = normalizeGooglePhotoUrl(url);

    const r = await fetch(src, { headers: { "User-Agent": "Bucketlist/1.0" } });
    if (!r.ok) throw new Error("FETCH_GOOGLE_AVATAR_FAILED");

    const inputBuf = Buffer.from(await r.arrayBuffer());

    // ตั้งชื่อใหม่ทุกครั้งด้วย timestamp
    const filename = `u${userId}_google_${Date.now()}.webp`;
    const absPath = path.join(uploadDir, filename);

    try {
        const out = await sharp(inputBuf)
            .rotate()
            .resize({ width: MAX_W, height: MAX_H, fit: "cover", position: "centre" })
            .webp({ quality: DEFAULT_QUALITY })
            .toBuffer();

        await fs.promises.writeFile(absPath, out);
        return `/uploads/avatars/${filename}`;
    } catch (err) {
        // fallback ถ้า sharp พัง
        const fallback = `u${userId}_google_${Date.now()}.jpg`;
        await fs.promises.writeFile(path.join(uploadDir, fallback), inputBuf);
        return `/uploads/avatars/${fallback}`;
    }
}

// callback หลัง Google ส่ง code กลับมา
router.get("/google/callback", async (req, res) => {
    try {
        const { code } = req.query;
        if (!code) return res.status(400).send("Missing code");

        // แลก code -> tokens
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                redirect_uri: process.env.GOOGLE_REDIRECT_URI,
                grant_type: "authorization_code",
            }),
        });

        if (!tokenRes.ok) {
            const t = await tokenRes.text();
            console.error("Token exchange failed:", t);
            return res.status(502).send("Google token exchange failed");
        }
        const tokenData = await tokenRes.json();

        // ขอข้อมูลผู้ใช้จาก Google
        const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        if (!userInfoRes.ok) {
            const t = await userInfoRes.text();
            console.error("Userinfo failed:", t);
            return res.status(502).send("Google userinfo failed");
        }
        const profile = await userInfoRes.json();
        // คาดหวัง: { sub, email, name, picture, ... }
        if (!profile?.email || !profile?.sub) {
            console.error("Profile missing email/sub:", profile);
            return res.status(400).send("Google profile incomplete");
        }

        // upsert by email (วิธี A)
        const [rows] = await pool.query(
            "SELECT id, email, profile_image FROM users WHERE email = ? LIMIT 1",
            [profile.email]
        );

        if (rows.length > 0) {
            // มีผู้ใช้อยู่แล้ว → อัปเดตให้เป็นบัญชี google และอัปเดตรูป/เวลาเข้าใช้
            await pool.query(
                `UPDATE users
          SET username = ?, provider = 'google',
              provider_sub = ?, updated_at = NOW(), last_login = NOW()
        WHERE id = ?`,
                [profile.name || profile.email, profile.sub, rows[0].id]
            );
        } else {
            await pool.query(
                `INSERT INTO users (username, email, password, profile_image, provider, provider_sub, created_at, updated_at, last_login)
       VALUES (?, ?, NULL, NULL, 'google', ?, NOW(), NOW(), NOW())`,
                [profile.name || profile.email, profile.email, profile.sub]
            );
        }

        // อ่าน user สำหรับออก JWT
        const [rows2] = await pool.query(
            "SELECT id, username, email, profile_image FROM users WHERE email = ? LIMIT 1",
            [profile.email]
        );
        const user = rows2[0];

        // ✅ ดาวน์โหลดรูปจาก Google → เซฟลง /uploads/avatars → ได้ "พาธภายในระบบ"
        const currentImg = user.profile_image || "";
        const wasLocal = currentImg.startsWith("/uploads/avatars/");

        try {
            const newRelPath = await downloadAndSaveGoogleAvatar(profile.picture, user.id);
            if (newRelPath) {
                // 1) อัปเดตให้ชี้ไฟล์ใหม่
                await pool.query("UPDATE users SET profile_image = ? WHERE id = ?", [newRelPath, user.id]);

                // 2) ถ้าไฟล์เดิมเป็น local และไม่ใช่ไฟล์เดียวกับที่เพิ่งเซฟ → ลบทิ้ง
                if (wasLocal && currentImg !== newRelPath) {
                    safeUnlinkAvatar(currentImg);
                }
            }
        } catch (e) {
            console.warn("DOWNLOAD_GOOGLE_AVATAR_FAIL:", e?.message);
        }

        // ออก JWT
        const appJwt = jwt.sign(
            { id: user.id, username: user.username, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        // ส่ง cookie (โปรดักชันควรเป็น https + sameSite=None)
        res.cookie("token", appJwt, {
            httpOnly: true,
            sameSite: "none",
            secure: true,
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        // กลับหน้าเว็บของคุณ
        res.redirect(`${process.env.WEB_BASE_URL}/home`);
    } catch (err) {
        console.error("Google callback error:", err);
        res.status(500).send("Internal error");
    }
});

export default router;