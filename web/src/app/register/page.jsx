"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "@/styles/register.module.css";

export default function RegisterPage() {
    const [form, setForm] = useState({
        username: "",
        email: "",
        password: "",
        confirm: "",
    });
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState(null);

    const onChange = (e) =>
        setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    const onSubmit = async (e) => {
        e.preventDefault();
        setMsg(null);

        if (form.password !== form.confirm) {
            setMsg({ type: "error", text: "รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน" });
            return;
        }
        if (form.password.length < 8) {
            setMsg({ type: "error", text: "รหัสผ่านอย่างน้อย 8 ตัวอักษร" });
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: form.username.trim(),
                    email: form.email.trim(),
                    password: form.password,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "สมัครไม่สำเร็จ");

            setMsg({ type: "success", text: "สมัครสำเร็จ! กำลังพาไปหน้าเข้าสู่ระบบ…" });
            // พาไปหน้า login หลัง 1-2 วิ
            setTimeout(() => (window.location.href = "/login"), 1200);
        } catch (err) {
            setMsg({ type: "error", text: err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <h1 className={styles.title}>✨ สมัครสมาชิก ✨</h1>
                <p className={styles.subtitle}>สร้างบัญชีใหม่ของคุณเพื่อเริ่มต้น Bucketlist</p>

                <form className={styles.form} onSubmit={onSubmit}>
                    <input
                        type="text"
                        name="username"
                        placeholder="ชื่อผู้ใช้"
                        className={styles.input}
                        required
                        maxLength={50}
                        value={form.username}
                        onChange={onChange}
                    />
                    <input
                        type="email"
                        name="email"
                        placeholder="อีเมล"
                        className={styles.input}
                        required
                        value={form.email}
                        onChange={onChange}
                    />
                    <input
                        type="password"
                        name="password"
                        placeholder="รหัสผ่าน (อย่างน้อย 8 ตัว)"
                        className={styles.input}
                        required
                        value={form.password}
                        onChange={onChange}
                    />
                    <input
                        type="password"
                        name="confirm"
                        placeholder="ยืนยันรหัสผ่าน"
                        className={styles.input}
                        required
                        value={form.confirm}
                        onChange={onChange}
                    />

                    <button type="submit" className={styles.submitBtn} disabled={loading}>
                        {loading ? "กำลังสมัคร…" : "ลงทะเบียน"}
                    </button>
                </form>

                {msg && (
                    <p
                        className={msg.type === "error" ? styles.error : styles.success}
                        role="alert"
                    >
                        {msg.text}
                    </p>
                )}

                <p className={styles.switch}>
                    มีบัญชีแล้ว?{" "}
                    <Link href="/login" className={styles.link}>
                        เข้าสู่ระบบ
                    </Link>
                </p>
            </div>
        </div>
    );
}