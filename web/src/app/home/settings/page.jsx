"use client";

import { useEffect, useRef, useState } from "react";
import s from "@/styles/settings.module.css";
import { API_BASE } from "@/lib/api";
import { absolutize } from "@/utils/url";

export default function SettingsPage({
    onUploadAvatar,      // (file: File) => Promise<string>
    onChangePassword,    // ({ currentPassword, newPassword }) => Promise<void>
}) {
    // ---- Avatar ----
    const fileRef = useRef(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [avatarUrl, setAvatarUrl] = useState("");
    const [avatarLoading, setAvatarLoading] = useState(false);
    const [me, setMe] = useState(null);

    const pickFile = () => fileRef.current?.click();
    const acceptImage = (f) => {
        if (!f) return null;
        if (!f.type?.startsWith("image/")) return "กรุณาเลือกรูปภาพ";
        if (f.size > 2 * 1024 * 1024) return "รูปต้องไม่เกิน 2MB";
        return null;
    };
    const handleFile = (f) => {
        const err = acceptImage(f);
        if (err) return alert(err);
        setAvatarPreview(URL.createObjectURL(f));
    };
    const onFileChange = (e) => {
        const f = e.target.files?.[0];
        if (f) handleFile(f);
    };
    const onDrop = (e) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f) handleFile(f);
    };

    const uploadAvatar = async () => {
        const f = fileRef.current?.files?.[0];
        if (!f) return alert("ยังไม่ได้เลือกรูป");
        setAvatarLoading(true);
        try {
            if (onUploadAvatar) {
                const url = await onUploadAvatar(f);
                setAvatarUrl(url);
            } else {
                // mock
                const form = new FormData();
                form.append("avatar", f);
                const res = await fetch(`${API_BASE}/auth/avatar`, {
                    method: "POST",
                    body: form,
                    credentials: "include",
                });
                if (!res.ok) throw new Error((await res.json()).message || "อัปโหลดไม่สำเร็จ");
                const data = await res.json();
                setAvatarUrl(data.url);
            }
            setAvatarPreview(null);
            fileRef.current.value = "";
            alert("อัปโหลดสำเร็จ");
        } catch (e) {
            alert(e?.message || "อัปโหลดไม่สำเร็จ");
        } finally {
            setAvatarLoading(false);
        }
    };

    // โหลดโปรไฟล์เดิม
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
                if (!res.ok) return;
                const json = await res.json();
                if (!alive) return;
                setMe(json?.user || null);
                setAvatarUrl(json?.user?.profile_image || "");
            } catch { }
        })();
        return () => { alive = false; };
    }, []);

    // ---- Password ----
    const [currentPwd, setCurrentPwd] = useState("");
    const [newPwd, setNewPwd] = useState("");
    const [confirmPwd, setConfirmPwd] = useState("");
    const [pwdLoading, setPwdLoading] = useState(false);
    const [pwdMsg, setPwdMsg] = useState(null);

    const validatePwd = () => {
        if (newPwd.length < 8) return "รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร";
        if (!/[0-9]/.test(newPwd)) return "รหัสผ่านใหม่ควรมีตัวเลขอย่างน้อย 1 ตัว";
        if (newPwd !== confirmPwd) return "รหัสผ่านใหม่และยืนยันไม่ตรงกัน";
        if (newPwd === currentPwd) return "รหัสผ่านใหม่ต้องไม่เหมือนรหัสเดิม";
        return null;
    };

    const submitPassword = async (e) => {
        e.preventDefault();
        setPwdMsg(null);
        const err = validatePwd();
        if (err) return setPwdMsg({ type: "error", text: err });

        setPwdLoading(true);
        try {
            if (onChangePassword) {
                await onChangePassword({ currentPassword: currentPwd, newPassword: newPwd });
            } else {
                const res = await fetch(`${API_BASE}/auth/change-password`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
                });
                if (!res.ok) throw new Error((await res.json()).message || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
            }
            setPwdMsg({ type: "success", text: "เปลี่ยนรหัสผ่านสำเร็จ" });
            setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
        } catch (e) {
            setPwdMsg({ type: "error", text: e?.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ" });
        } finally {
            setPwdLoading(false);
        }
    };

    // ---- Topic (จัดการหัวข้อ) ----
    const [topics, setTopics] = useState([]);
    const [loadingTopics, setLoadingTopics] = useState(false);

    const loadTopics = async () => {
        setLoadingTopics(true);
        try {
            const res = await fetch(`${API_BASE}/topics/owned`, {
                credentials: "include",
            });
            if (!res.ok) throw new Error((await res.json()).error || "โหลดหัวข้อไม่สำเร็จ");
            const data = await res.json();
            setTopics(data.data || []);
        } catch (e) {
            alert(e.message);
        } finally {
            setLoadingTopics(false);
        }
    };

    useEffect(() => {
        loadTopics();
    }, []);

    const handleEdit = async (topic) => {
        const title = prompt("แก้ไขชื่อหัวข้อ", topic.title);
        if (title == null) return;
        const t = title.trim();
        if (!t) return alert("ห้ามเว้นว่าง");
        try {
            const res = await fetch(`${API_BASE}/topics/${topic.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ title: t }),
            });
            if (!res.ok) throw new Error((await res.json()).error || "แก้ไขไม่สำเร็จ");
            await loadTopics();
        } catch (e) {
            alert(e.message);
        }
    };

    const handleDelete = async (topic) => {
        if (!confirm(`ลบหัวข้อ “${topic.title}” ?`)) return;
        try {
            const res = await fetch(`${API_BASE}/topics/${topic.id}`, {
                method: "DELETE",
                credentials: "include",
            });
            if (!res.ok) throw new Error((await res.json()).error || "ลบไม่สำเร็จ");
            await loadTopics();
        } catch (e) {
            alert(e.message);
        }
    };

    return (
        <div className={s.wrap}>
            <h1 className={s.title}>Settings</h1>

            {/* Avatar */}
            <section className={s.card}>
                <h2 className={s.cardTitle}>รูปโปรไฟล์</h2>

                <div className={s.avatarRow}>
                    <img
                        className={s.avatar}
                        src={
                            avatarPreview
                            || (avatarUrl ? absolutize(avatarUrl) : null)
                            || (me ? `https://i.pravatar.cc/120?u=${encodeURIComponent(me.id)}` : null)
                            || "/no-image.png"
                        }
                        alt="avatar"
                    />
                    <div className={s.avatarBtns}>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            className={s.hiddenFile}
                            onChange={onFileChange}
                        />
                        <button className={s.btn} onClick={pickFile}>เลือกไฟล์</button>
                        {avatarPreview && (
                            <>
                                <button className={s.btnPrimary} onClick={uploadAvatar} disabled={avatarLoading}>
                                    {avatarLoading ? "กำลังอัปโหลด..." : "อัปโหลด"}
                                </button>
                                <button
                                    className={s.btnGhost}
                                    onClick={() => { setAvatarPreview(null); fileRef.current.value = ""; }}
                                >
                                    ยกเลิกตัวอย่าง
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div
                    className={s.dropzone}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={onDrop}
                    aria-label="วางไฟล์รูปเพื่ออัปโหลด"
                >
                    ลากแล้ววางไฟล์รูปที่นี่ (สูงสุด 2MB)
                </div>
                <p className={s.hint}>รองรับ .jpg .png .webp ขนาดไม่เกิน 2MB</p>
            </section>

            {/* Password */}
            <section className={s.card}>
                <h2 className={s.cardTitle}>เปลี่ยนรหัสผ่าน</h2>
                <form className={s.form} onSubmit={submitPassword}>
                    <label className={s.label}>
                        รหัสผ่านปัจจุบัน
                        <input
                            type="password"
                            className={s.input}
                            value={currentPwd}
                            onChange={(e) => setCurrentPwd(e.target.value)}
                            autoComplete="current-password"
                            required
                        />
                    </label>

                    <label className={s.label}>
                        รหัสผ่านใหม่
                        <input
                            type="password"
                            className={s.input}
                            value={newPwd}
                            onChange={(e) => setNewPwd(e.target.value)}
                            autoComplete="new-password"
                            required
                        />
                    </label>

                    <label className={s.label}>
                        ยืนยันรหัสผ่านใหม่
                        <input
                            type="password"
                            className={s.input}
                            value={confirmPwd}
                            onChange={(e) => setConfirmPwd(e.target.value)}
                            autoComplete="new-password"
                            required
                        />
                    </label>

                    <button className={s.btnPrimary} type="submit" disabled={pwdLoading}>
                        {pwdLoading ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
                    </button>

                    {pwdMsg && (
                        <div className={pwdMsg.type === "success" ? s.alertSuccess : s.alertError}>
                            {pwdMsg.text}
                        </div>
                    )}
                </form>
                <p className={s.hint}>อย่างน้อย 8 ตัวอักษร และควรมีตัวเลข 1 ตัวขึ้นไป</p>
            </section>

            {/* Topics */}
            <section className={s.card}>
                <h2 className={s.cardTitle}>จัดการหัวข้อ</h2>
                {loadingTopics ? (
                    <p>กำลังโหลด...</p>
                ) : topics.length === 0 ? (
                    <p className={s.hint}>ยังไม่มีหัวข้อ</p>
                ) : (
                    <ul className={s.list}>
                        {topics.map((t) => (
                            <li key={t.id} className={s.item}>
                                <div className={s.topicLink}>
                                    <span>{t.title}</span>
                                    <div className={s.actions}>
                                        <button
                                            type="button"
                                            className={s.actionBtn}
                                            onClick={() => handleEdit(t)}
                                            aria-label="แก้ไขรายการ"
                                            title="แก้ไข"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            type="button"
                                            className={s.actionBtn}
                                            onClick={() => handleDelete(t)}
                                            aria-label="ลบรายการ"
                                            title="ลบ"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}