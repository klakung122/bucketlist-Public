"use client";

import { useRef, useState } from "react";
import s from "@/styles/settings.module.css";

export default function SettingsPage({
    // ให้คุณส่ง callback จริงมาทีหลังได้ (ต่อ API เอง)
    onUploadAvatar,      // (file: File) => Promise<string> // return avatar URL
    onChangePassword,    // ({ currentPassword, newPassword }) => Promise<void>
}) {
    // ---- Avatar ----
    const fileRef = useRef(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [avatarUrl, setAvatarUrl] = useState(""); // โหลดจากโปรไฟล์จริงได้ภายหลัง
    const [avatarLoading, setAvatarLoading] = useState(false);

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
                const url = await onUploadAvatar(f); // คุณจะต่อ API จริงเอง
                setAvatarUrl(url);
            } else {
                // mock ไม่มี backend
                await new Promise((r) => setTimeout(r, 800));
                setAvatarUrl(avatarPreview);
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
                // mock ไม่มี backend
                await new Promise((r) => setTimeout(r, 700));
            }
            setPwdMsg({ type: "success", text: "เปลี่ยนรหัสผ่านสำเร็จ" });
            setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
        } catch (e) {
            setPwdMsg({ type: "error", text: e?.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ" });
        } finally {
            setPwdLoading(false);
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
                        src={avatarPreview || avatarUrl || "https://i.pravatar.cc/160?img=5"}
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
        </div>
    );
}