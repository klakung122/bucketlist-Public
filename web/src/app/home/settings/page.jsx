"use client";

import { useEffect, useRef, useState } from "react";
import s from "@/styles/settings.module.css";
import { API_BASE } from "@/lib/api";
import { absolutize } from "@/utils/url";
import Swal from "sweetalert2";
import { FaPen, FaTrash } from "react-icons/fa";

export default function SettingsPage({
    onUploadAvatar,      // (file: File) => Promise<string>
    onChangePassword,    // ({ currentPassword, newPassword }) => Promise<void>
}) {
    const [hydrated, setHydrated] = useState(false);
    // ---- Avatar ----
    const fileRef = useRef(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [avatarUrl, setAvatarUrl] = useState("");
    const [avatarLoading, setAvatarLoading] = useState(false);
    const [me, setMe] = useState(null);
    const [meLoading, setMeLoading] = useState(true);
    const [editOpen, setEditOpen] = useState(false);
    const [editingTopic, setEditingTopic] = useState(null);
    const [editTitle, setEditTitle] = useState("");
    const [editLoading, setEditLoading] = useState(false);
    const [editDesc, setEditDesc] = useState("");

    useEffect(() => { setHydrated(true); }, []);

    const openEdit = (topic) => {
        setEditingTopic(topic);
        setEditTitle(topic.title || "");
        setEditDesc(topic.description ?? "");
        setEditOpen(true);
    };
    const closeEdit = () => {
        if (editLoading) return;
        setEditOpen(false);
        setEditingTopic(null);
        setEditTitle("");
        setEditDesc("");
    };

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
            } catch {
            } finally {
                if (alive) setMeLoading(false);
            }
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
    const [loadingTopics, setLoadingTopics] = useState(true);

    const loadTopics = async () => {
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

    const handleDelete = async (topic) => {
        const ok = await Swal.fire({
            title: `ลบหัวข้อ “${topic.title}” ?`,
            text: "การลบนี้จะถาวรและไม่สามารถกู้คืนได้",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "ลบ",
            cancelButtonText: "ยกเลิก",
            confirmButtonColor: "#ef4444",
        }).then(r => r.isConfirmed);

        if (!ok) return;

        try {
            const res = await fetch(`${API_BASE}/topics/${topic.id}`, {
                method: "DELETE",
                credentials: "include",
            });
            if (!res.ok) throw new Error((await res.json()).error || "ลบไม่สำเร็จ");

            await loadTopics();

            Swal.fire({
                toast: true,
                position: "top",
                icon: "success",
                title: "ลบหัวข้อแล้ว",
                showConfirmButton: false,
                timer: 1500,
            });
        } catch (e) {
            Swal.fire({
                icon: "error",
                title: "ลบไม่สำเร็จ",
                text: e?.message || "ลองใหม่อีกครั้ง",
                confirmButtonColor: "#ef4444",
            });
        }
    };

    return (
        <div className={s.wrap}>
            <h1 className={s.title}>Settings</h1>

            {/* Avatar */}
            <section className={s.card}>
                <h2 className={s.cardTitle}>รูปโปรไฟล์</h2>

                <div className={s.avatarRow}>
                    {(!hydrated || meLoading) ? (
                        <div className={s.avatarSkel} aria-hidden="true" />
                    ) : (
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
                    )}
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
                <p className={s.hint}>อย่างน้อย 8 ตัวอักษร</p>
            </section>

            {/* Topics */}
            <section className={s.card}>
                <h2 className={s.cardTitle}>จัดการหัวข้อ</h2>
                {loadingTopics ? (
                    <ul className={s.list} aria-busy="true" aria-live="polite">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <li key={i} className={`${s.item} ${s.topicSkelItem}`}>
                                <span className={s.skelLine} aria-hidden="true" />
                                <div className={s.skelActions} aria-hidden="true">
                                    <span className={s.skelIcon} />
                                    <span className={s.skelIcon} />
                                </div>
                            </li>
                        ))}
                    </ul>
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
                                            onClick={() => openEdit(t)}
                                            aria-label="แก้ไขรายการ"
                                            title="แก้ไข"
                                        >
                                            <FaPen />
                                        </button>
                                        <button
                                            type="button"
                                            className={s.actionBtn}
                                            onClick={() => handleDelete(t)}
                                            aria-label="ลบรายการ"
                                            title="ลบ"
                                        >
                                            <FaTrash />
                                        </button>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <EditTopicModal
                open={editOpen}
                onClose={closeEdit}
                value={editTitle}
                onChange={setEditTitle}
                desc={editDesc}
                onChangeDesc={setEditDesc}
                loading={editLoading}
                onSubmit={async () => {
                    const t = editTitle.trim();
                    if (!t) return alert("ห้ามเว้นว่าง");

                    setEditLoading(true);
                    try {
                        const res = await fetch(`${API_BASE}/topics/${editingTopic.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            credentials: "include",
                            body: JSON.stringify({ title: t, description: editDesc }),
                        });
                        const json = await res.json().catch(() => ({}));
                        if (!res.ok || json?.ok === false) {
                            throw new Error(json?.error || "แก้ไขไม่สำเร็จ");
                        }
                        await loadTopics();
                        closeEdit();
                    } catch (e) {
                        alert(e.message || "แก้ไขไม่สำเร็จ");
                    } finally {
                        setEditLoading(false);
                    }
                }}
            />
        </div>
    );
}

function EditTopicModal({ open, onClose, value, onChange, desc, onChangeDesc, onSubmit, loading }) {
    const dialogId = "edit-topic-title";
    const overlayRef = useRef(null);
    const inputRef = useRef(null);
    const closeBtnRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
        document.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        queueMicrotask(() => {
            if (!value.trim()) inputRef.current?.focus();
        });
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            ref={overlayRef}
            className={s.modalOverlay}
            onClick={() => !loading && onClose?.()}
            aria-hidden={!open}
        >
            <div
                className={s.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby={dialogId}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                    if (e.key === "Tab") {
                        const focusables = Array.from(
                            e.currentTarget.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')
                        ).filter(el => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
                        if (!focusables.length) return;
                        const first = focusables[0], last = focusables[focusables.length - 1];
                        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
                    }
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                        e.preventDefault();
                        if (!loading && value.trim()) onSubmit?.();
                    }
                }}
            >
                <div className={s.modalHeader}>
                    <h3 id={dialogId}>แก้ไขหัวข้อ</h3>
                    <button
                        type="button"
                        className={s.modalClose}
                        onClick={() => !loading && onClose?.()}
                        aria-label="ปิดหน้าต่าง"
                        title="ปิด"
                        ref={closeBtnRef}
                    >
                        ✕
                    </button>
                </div>

                <form
                    className={s.modalBody}
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!loading && value.trim()) onSubmit?.();
                    }}
                >
                    <label className={s.label} htmlFor="topic-title-input">ชื่อหัวข้อ</label>
                    <input
                        id="topic-title-input"
                        ref={inputRef}
                        className={s.input}
                        type="text"
                        placeholder="ตั้งชื่อหัวข้อของคุณ"
                        value={value}
                        onChange={(e) => onChange?.(e.target.value)}
                        disabled={loading}
                        autoComplete="off"
                        spellCheck={false}
                    />

                    <label
                        className={s.label}
                        htmlFor="topic-desc"
                        style={{ marginTop: 12 }}
                    >
                        รายละเอียดเพิ่มเติม
                    </label>
                    <textarea
                        id="topic-desc"
                        placeholder="รายละเอียดเพิ่มเติม"
                        className={s.textarea}
                        disabled={loading}
                        rows={3}
                        value={desc}
                        onChange={(e) => onChangeDesc?.(e.target.value)}
                    />

                    <div className={s.modalActions}>
                        <button type="submit" className={s.btnPrimary} disabled={!value.trim() || loading}>
                            {loading ? "กำลังบันทึก..." : "บันทึก"}
                        </button>
                        <button type="button" className={s.btnGhost} onClick={() => !loading && onClose?.()}>
                            ยกเลิก
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}