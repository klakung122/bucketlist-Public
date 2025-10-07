"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "@/styles/login.module.css";
import { API_BASE } from "@/lib/api";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [msg, setMsg] = useState(null);
    const [loading, setLoading] = useState(false);
    const [gLoading, setGLoading] = useState(false);

    const onSubmit = async (e) => {
        e.preventDefault();
        setMsg(null);

        try {
            const res = await fetch(
                `${API_BASE}/auth/login`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include", // สำคัญ! เพื่อเก็บ cookie
                    body: JSON.stringify({ username, password }),
                }
            );

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "เข้าสู่ระบบไม่สำเร็จ");

            setMsg({ type: "success", text: "เข้าสู่ระบบสำเร็จ!" });
            window.location.href = "/home";
        } catch (err) {
            setMsg({ type: "error", text: err.message });
        }
    };

    const onGoogleClick = () => {
        setGLoading(true);
        // ส่งผู้ใช้ไปเริ่ม OAuth ที่ backend
        window.location.href = `${API_BASE}/auth/google`;
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <h1 className={styles.title}>🌸 เข้าสู่ระบบ 🌸</h1>
                <p className={styles.subtitle}>ยินดีต้อนรับกลับมา!</p>

                <form className={styles.form} onSubmit={onSubmit}>
                    <input
                        type="text"
                        placeholder="ชื่อผู้ใช้"
                        className={styles.input}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        disabled={loading || gLoading}
                    />
                    <input
                        type="password"
                        placeholder="รหัสผ่าน"
                        className={styles.input}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading || gLoading}
                    />
                    <button
                        type="submit"
                        className={styles.submitBtn}
                        disabled={loading || gLoading}
                    >
                        {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
                    </button>
                </form>

                <div className={styles.divider}><span>หรือ</span></div>

                <button
                    className={styles.googleBtn}
                    onClick={onGoogleClick}
                    disabled={loading || gLoading}
                    aria-label="Sign in with Google"
                >
                    <img src="/google-logo.png" alt="" width={18} height={18} />
                    {gLoading ? "กำลังไปที่ Google..." : "Sign in with Google"}
                </button>

                {msg && (
                    <p
                        className={msg.type === "error" ? styles.error : styles.success}
                        role="alert"
                    >
                        {msg.text}
                    </p>
                )}

                <p className={styles.switch}>
                    ยังไม่มีบัญชี?{" "}
                    <Link href="/register" className={styles.link}>
                        สมัครสมาชิก
                    </Link>
                </p>
            </div>
        </div>
    );
}