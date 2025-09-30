"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Swal from "sweetalert2";
import { FaPlus, FaCheck } from "react-icons/fa";
import { MdOutlineChecklist } from "react-icons/md";
import styles from "@/styles/topic.module.css";
import { API_BASE } from "@/lib/api";
import { absolutize } from "@/utils/url";

export default function TopicPage() {
    const { slug } = useParams();

    const [lists, setLists] = useState([]); // {id, text, done}
    const [loading, setLoading] = useState(false);
    const [topic, setTopic] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [invites, setInvites] = useState([]); // tokens list
    const [members, setMembers] = useState([]);
    const [isOwner, setIsOwner] = useState(false);
    const [showMembers, setShowMembers] = useState(false);

    // โหลด topic + me แล้วคำนวณว่าเป็น owner ไหม
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const [resTopic, resMe] = await Promise.all([
                    fetch(`${API_BASE}/topics/${slug}`, { credentials: "include" }),
                    fetch(`${API_BASE}/auth/me`, { credentials: "include" }),
                ]);

                if (resTopic.status === 401 || resMe.status === 401) {
                    window.location.href = "/login?next=/home/" + slug;
                    return;
                }

                const [jTopic, jMe] = await Promise.all([resTopic.json(), resMe.json()]);

                if (alive && jTopic?.ok) setTopic(jTopic.data);
                if (alive && jTopic?.ok && jMe?.user) {
                    // ปรับคีย์ด้านล่างให้ตรงกับสคีมาจริง เช่น owner_id หรือ created_by
                    const ownerId = jTopic.data.owner_id ?? jTopic.data.created_by;
                    setIsOwner(jMe.user.id === ownerId);
                }
            } catch (e) {
                console.error(e);
            }
        })();
        return () => { alive = false; };
    }, [slug]);

    // โหลด members เสมอ และโหลด invites เฉพาะเมื่อเป็น owner เท่านั้น
    useEffect(() => {
        (async () => {
            try {
                // members: ให้ทุกคนเห็น
                const resMembers = await fetch(`${API_BASE}/topics/${slug}/members`, { credentials: "include" });
                const jm = await resMembers.json();
                if (jm.ok) setMembers(jm.data);

                // invites: owner เท่านั้น
                if (isOwner) {
                    const resInv = await fetch(`${API_BASE}/topics/${slug}/invites`, { credentials: "include" });
                    if (resInv.ok) {
                        const ji = await resInv.json();
                        if (ji.ok) setInvites(ji.data);
                    }
                } else {
                    // เผื่อเดิมเคยค้างค่าอยู่
                    setInvites([]);
                }
            } catch (e) {
                console.error(e);
            }
        })();
    }, [slug, isOwner]);

    // ปุ่มสร้างลิงก์: กันพลาดเช็คอีกชั้น
    const createInvite = async () => {
        if (!isOwner) {
            return Swal.fire({ icon: "error", title: "คุณไม่ใช่เจ้าของหัวข้อนี้" });
        }
        try {
            const res = await fetch(`${API_BASE}/topics/${slug}/invites`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ maxUses: 1, expiresInDays: 1 }),
            });
            if (res.status === 401) return (window.location.href = "/login?next=/home/" + slug);
            if (res.status === 403) return Swal.fire({ icon: "error", title: "เฉพาะเจ้าของหัวข้อเท่านั้น" });

            const json = await res.json();
            if (!json.ok) return Swal.fire({ icon: "error", title: "สร้างลิงก์ไม่สำเร็จ" });

            await navigator.clipboard.writeText(json.data.invite_url);
            Swal.fire({ icon: "success", title: "คัดลอกลิงก์เชิญแล้ว", text: "ลิงก์นี้ใช้ได้ 1 คน / 24 ชม.", confirmButtonColor: "#8b5cf6" });

            // refresh เฉพาะ owner
            const r2 = await fetch(`${API_BASE}/topics/${slug}/invites`, { credentials: "include" });
            const j2 = await r2.json();
            if (j2.ok) setInvites(j2.data);
        } catch (e) {
            console.error(e);
            Swal.fire({ icon: "error", title: "สร้างลิงก์ไม่สำเร็จ" });
        }
    };

    // โหลด lists ของหัวข้อนี้
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/topics/${slug}/lists`, { credentials: "include" });
                if (res.status === 401) { window.location.href = "/login?next=/home/" + slug; return; }
                if (res.status === 403) { console.warn("Forbidden"); return; }
                const json = await res.json();
                if (!alive) return;
                if (json.ok) {
                    // แปลง status -> done
                    const mapped = json.data.map(r => ({
                        id: r.id,
                        text: r.title,
                        done: r.status === "archived",
                    }));
                    setLists(mapped);
                }
            } catch (e) {
                console.error(e);
            }
        })();
        return () => { alive = false; };
    }, [slug]);

    const addList = useCallback(async () => {
        const { value } = await Swal.fire({
            title: "เพิ่มลิสต์ใหม่",
            input: "text",
            inputLabel: "พิมพ์ชื่อรายการ",
            inputPlaceholder: "เช่น จัดกระเป๋า / ทำวีซ่า",
            confirmButtonText: "เพิ่ม",
            confirmButtonColor: "#8b5cf6",
            allowOutsideClick: true,
            showCancelButton: false,
            preConfirm: (val) => {
                if (!val || !val.trim()) {
                    Swal.showValidationMessage("กรุณากรอกชื่อรายการ");
                    return false;
                }
                return val.trim();
            },
            didOpen: () => setTimeout(() => Swal.getInput()?.focus(), 0),
        });
        if (!value) return;

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/topics/${slug}/lists`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ title: value }),
            });
            if (res.status === 401) return window.location.href = "/login?next=/home/" + slug;
            if (res.status === 403) return Swal.fire({ icon: "error", title: "ไม่มีสิทธิ์" });
            const json = await res.json();

            if (!json.ok) {
                if (json.error === "DUPLICATE_TITLE") {
                    Swal.fire({ icon: "error", title: "มีรายการนี้แล้ว", text: "ชื่อนี้ซ้ำในหัวข้อนี้", confirmButtonColor: "#ef4444" });
                } else {
                    Swal.fire({ icon: "error", title: "เพิ่มไม่สำเร็จ", text: "ลองใหม่อีกครั้ง", confirmButtonColor: "#ef4444" });
                }
                setLoading(false);
                return;
            }

            setLists(prev => [{ id: json.data.id, text: json.data.title, done: false }, ...prev]);
            Swal.fire({
                toast: true, position: "top-end", icon: "success",
                title: "เพิ่มลิสต์แล้ว", showConfirmButton: false, timer: 1400, timerProgressBar: true,
            });
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [slug]);

    const toggleDone = useCallback(async (index) => {
        const item = lists[index];
        if (!item) return;
        const nextDone = !item.done;

        // อัปเดตแบบ optimistic
        setLists(prev => prev.map((it, i) => i === index ? { ...it, done: nextDone } : it));

        try {
            const res = await fetch(`${API_BASE}/lists/${item.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ status: nextDone ? "archived" : "active" }),
            });
            if (res.status === 401) return window.location.href = "/login?next=/home/" + slug;
            if (res.status === 403) return Swal.fire({ icon: "error", title: "ไม่มีสิทธิ์" });
            const json = await res.json();
            if (!json.ok) {
                // rollback ถ้าพัง
                setLists(prev => prev.map((it, i) => i === index ? { ...it, done: !nextDone } : it));
                Swal.fire({ icon: "error", title: "อัปเดตไม่สำเร็จ", confirmButtonColor: "#ef4444" });
            }
        } catch (e) {
            console.error(e);
            // rollback
            setLists(prev => prev.map((it, i) => i === index ? { ...it, done: !nextDone } : it));
        }
    }, [lists]);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/topics/${slug}`, {
                    credentials: "include",
                });
                if (res.status === 401) { window.location.href = "/login?next=/home/" + slug; return; }
                if (res.status === 403) { console.warn("Forbidden"); return; }
                const json = await res.json();
                if (json.ok) setTopic(json.data);
            } catch (err) {
                console.error(err);
            }
        })();
    }, [slug]);

    const handleEdit = async (index) => {
        const item = lists[index];
        const { value } = await Swal.fire({
            title: "แก้ไขรายการ",
            input: "text",
            inputValue: item.text,
            confirmButtonText: "บันทึก",
            showCancelButton: true,
            confirmButtonColor: "#8b5cf6",
        });
        if (!value || !value.trim()) return;

        try {
            const res = await fetch(`${API_BASE}/lists/${item.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ title: value.trim() }),
            });
            const json = await res.json();
            if (json.ok) {
                setLists(prev => prev.map((it, i) =>
                    i === index ? { ...it, text: value.trim() } : it
                ));
            } else {
                Swal.fire({ icon: "error", title: "แก้ไขไม่สำเร็จ" });
            }
        } catch (e) {
            console.error(e);
        }
    };

    const removeMember = async (userId) => {
        if (!isOwner) return;
        // กันลบเจ้าของหัวข้อ
        const ownerId = topic?.owner_id; // สคีมาใช้ owner_id แน่นอน
        if (userId === ownerId) return;

        const ok = await Swal.fire({
            title: "ลบสมาชิกออกจากหัวข้อนี้?",
            text: "สมาชิกจะเข้าหัวข้อนี้ไม่ได้จนกว่าจะได้รับเชิญอีกครั้ง",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "ลบ",
            cancelButtonText: "ยกเลิก",
            confirmButtonColor: "#ef4444",
        }).then(r => r.isConfirmed);

        if (!ok) return;

        try {
            const res = await fetch(`${API_BASE}/topics/${slug}/members/${userId}`, {
                method: "DELETE",
                credentials: "include",
            });
            if (res.status === 401) return (window.location.href = "/login?next=/home/" + slug);
            if (res.status === 403) return Swal.fire({ icon: "error", title: "ไม่มีสิทธิ์" });

            // success แบบ 204 (ไม่มีบอดี้)
            if (res.status === 204) {
                setMembers(prev => prev.filter(m => String(m.id) !== String(userId)));
                Swal.fire({ toast: true, position: "top", icon: "success", title: "ลบแล้ว", showConfirmButton: false, timer: 1300 });
                return;
            }

            // เผื่อ API ตอบเป็น JSON
            let json = null;
            const ct = res.headers.get("content-type") || "";
            if (ct.includes("application/json")) {
                json = await res.json();
            } else {
                const text = await res.text(); // กันเคสตอบ text
                try { json = text ? JSON.parse(text) : null; } catch { json = null; }
            }

            if (json && json.ok) {
                setMembers(prev => prev.filter(m => m.id !== userId));
                Swal.fire({ toast: true, position: "top", icon: "success", title: "ลบแล้ว", showConfirmButton: false, timer: 1300 });
            } else {
                Swal.fire({ icon: "error", title: "ลบไม่สำเร็จ" });
            }
        } catch (e) {
            console.error(e);
            Swal.fire({ icon: "error", title: "ลบไม่สำเร็จ" });
        }
    };

    if (!topic) return <h1 className={styles.title}>กำลังโหลด...</h1>;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>
                    <MdOutlineChecklist />{topic.title}
                </h1>
            </header>

            <section className={styles.box}>
                <h2 className={styles.boxTitle}>จัดการลิสต์</h2>
                <div className={styles.actionGroup}>
                    <button type="button" className={styles.addBtn} onClick={addList} disabled={loading}>
                        <FaPlus /> เพิ่ม
                    </button>
                </div>
            </section>

            {/* Invite Friends */}
            <section className={styles.box}>
                <h2 className={styles.boxTitle}>เชิญเพื่อน</h2>

                {/* สมาชิก */}
                <div className={styles.inviteRow}>
                    <div
                        className={styles.avatars}
                        role="button"
                        tabIndex={0}
                        onClick={() => setShowMembers(true)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setShowMembers(true);
                            }
                        }}
                        title="ดูสมาชิกทั้งหมด"
                    >
                        {/* โชว์ 3 คนแรก */}
                        {members.slice(0, Math.min(3, members.length)).map((m) => (
                            <img
                                key={m.id}
                                src={absolutize(m.profile_image) || `https://i.pravatar.cc/40?u=${m.id}`}
                                alt={m.username}
                                title={m.username}
                            />
                        ))}

                        {/* ถ้ามากกว่า 3 → ใช้ more.png */}
                        {members.length > 3 && (
                            <img
                                src="/more.png"
                                alt={`+${members.length - 3}`}
                                title={`สมาชิกเพิ่มอีก ${members.length - 3} คน`}
                                className={styles.moreAvatar}
                            />
                        )}
                    </div>

                    {/* ปุ่มสร้างลิงก์: แสดงเฉพาะ owner */}
                    {isOwner && (
                        <button onClick={createInvite} className={styles.inviteBtn}>
                            ➕ สร้างลิงก์เชิญ
                        </button>
                    )}
                </div>
            </section>

            <section className={styles.box}>
                <div className={styles.boxTitleCon}>
                    <h2 className={styles.boxTitle}>ลิสต์ทั้งหมด</h2>
                    <button
                        type="button"
                        className={styles.editBtn}
                        onClick={() => setEditMode(prev => !prev)}
                    >
                        {editMode ? "✅ เสร็จสิ้น" : "✏️ แก้ไข"}
                    </button>
                </div>

                {lists.length === 0 ? (
                    <p className={styles.empty}>ยังไม่มีลิสต์ ✨</p>
                ) : (
                    <ul className={styles.list}>
                        {lists.map((item, idx) => (
                            <li
                                key={item.id}
                                className={`${styles.listItem} ${item.done ? styles.done : ""}`}
                                onClick={!editMode ? () => toggleDone(idx) : undefined}
                            >
                                <div className={styles.listTitle}>
                                    <span className={styles.circle}>
                                        {item.done && <FaCheck className={styles.checkIcon} />}
                                    </span>
                                    <span className={`${item.done ? styles.doneText : ""}`}>{item.text}</span>
                                </div>

                                {editMode && !item.done && (
                                    <div className={styles.actions}>
                                        <button
                                            type="button"
                                            className={styles.actionBtn}
                                            onClick={() => handleEdit(idx)}
                                            aria-label="แก้ไขรายการ"
                                            title="แก้ไข"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.actionBtn}
                                            onClick={() => handleDelete(idx)}
                                            aria-label="ลบรายการ"
                                            title="ลบ"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <MembersModal
                open={showMembers}
                onClose={() => setShowMembers(false)}
                members={members}
                isOwner={isOwner}
                ownerId={topic?.owner_id ?? topic?.created_by}
                onRemoveMember={removeMember}
            />
        </div>
    );
}

function MembersModal({
    open,
    onClose,
    members = [],
    isOwner = false,
    ownerId,
    onRemoveMember,
}) {
    const dialogId = "members-modal-title";
    const overlayRef = useRef(null);
    const closeBtnRef = useRef(null);

    // ปิดเมื่อกด ESC + ล็อก scroll หน้า
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key === "Escape") onClose?.();
        };
        document.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        // โฟกัสปุ่มปิดเมื่อเปิด
        queueMicrotask(() => closeBtnRef.current?.focus());
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [open, onClose]);

    // ปิดการโฟกัสของพื้นหลังด้วย inert (เฉพาะตอนเปิด)
    useEffect(() => {
        if (!open) return;
        const overlayEl = overlayRef.current;
        if (!overlayEl) return;
        // ใส่ inert ให้ “พี่น้อง” ของ overlay (ทั้งหน้า) เพื่อกันโฟกัสพื้นหลัง
        const parent = overlayEl.parentElement;
        const siblings = parent ? Array.from(parent.children).filter(el => el !== overlayEl) : [];
        siblings.forEach(el => el.setAttribute('inert', ''));
        return () => siblings.forEach(el => el.removeAttribute('inert'));
    }, [open]);

    if (!open) return null;

    return (
        <div
            ref={overlayRef}
            className={styles.modalOverlay}
            onClick={onClose}
        >
            <div
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby={dialogId}
                onClick={(e) => e.stopPropagation()}
                // focus trap แบบง่าย: วนโฟกัสในกล่อง
                onKeyDown={(e) => {
                    if (e.key !== 'Tab') return;
                    const focusables = Array.from(
                        e.currentTarget.querySelectorAll(
                            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                        )
                    ).filter(el => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
                    if (focusables.length === 0) return;
                    const first = focusables[0];
                    const last = focusables[focusables.length - 1];
                    if (e.shiftKey && document.activeElement === first) {
                        e.preventDefault(); last.focus();
                    } else if (!e.shiftKey && document.activeElement === last) {
                        e.preventDefault(); first.focus();
                    }
                }}
            >
                <div className={styles.modalHeader}>
                    <h3 id={dialogId}>สมาชิกทั้งหมด ({members.length})</h3>
                    <button
                        type="button"
                        className={styles.modalClose}
                        onClick={onClose}
                        aria-label="ปิดหน้าต่าง"
                        title="ปิด"
                        ref={closeBtnRef}
                    >
                        ✕
                    </button>
                </div>

                <div className={styles.modalBody}>
                    {members.length === 0 ? (
                        <p className={styles.empty}>ยังไม่มีสมาชิก ✨</p>
                    ) : (
                        <div className={styles.membersGrid}>
                            {members.map((m) => (
                                <div className={styles.avatarItem} key={m.id}>
                                    <img
                                        className={styles.avatarImgLg}
                                        src={(m.profile_image && absolutize(m.profile_image)) || `https://i.pravatar.cc/100?u=${m.id}`}
                                        alt={m.username}
                                    />
                                    {isOwner && m.id !== ownerId && (
                                        <button
                                            type="button"
                                            className={styles.avatarRemove}
                                            aria-label={`ลบ ${m.username}`}
                                            title="ลบสมาชิก"
                                            onClick={() => onRemoveMember?.(m.id)}
                                        >
                                            ✕
                                        </button>
                                    )}
                                    <span className={styles.avatarName} title={m.username}>{m.username}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}