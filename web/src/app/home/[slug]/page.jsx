"use client";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import Swal from "sweetalert2";
import { FaPlus, FaCheck, FaPen, FaTrash } from "react-icons/fa";
import { MdOutlineChecklist } from "react-icons/md";
import styles from "@/styles/topic.module.css";
import { API_BASE } from "@/lib/api";
import { socket } from "@/lib/socket";
import { toImgSrc } from "@/lib/img";

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
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newListTitle, setNewListTitle] = useState("");
    const [newListDesc, setNewListDesc] = useState("");
    const [viewOpen, setViewOpen] = useState(false);
    const [viewIndex, setViewIndex] = useState(-1);
    const [editOpen, setEditOpen] = useState(false);
    const [editIndex, setEditIndex] = useState(-1);
    const [editTitle, setEditTitle] = useState("");
    const [editDesc, setEditDesc] = useState("");
    const [editLoading, setEditLoading] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [avatarUrlMap, setAvatarUrlMap] = useState({});
    const [inviteOpen, setInviteOpen] = useState(false);
    const [inviteUrl, setInviteUrl] = useState("");

    // ✅ join/leave ห้องหัวข้อ + ฟังอีเวนต์ลิสต์
    useEffect(() => {
        if (!slug) return;
        if (!socket.connected) socket.connect();
        socket.emit("join:topic", slug);

        const onMemberAdded = ({ slug: s, user }) => {
            if (s !== slug || !user) return;
            setMembers(prev => (prev.some(m => String(m.id) === String(user.id)) ? prev : [...prev, user]));
        };

        const onCreated = ({ slug: s, list }) => {
            if (s !== slug) return;
            setLists(prev => (prev.some(it => it.id === list.id) ? prev : [
                {
                    id: list.id,
                    text: list.title,
                    description: list.description ?? "",
                    done: list.status === "archived",
                },
                ...prev
            ]));
        };

        const onUpdated = ({ slug: s, list }) => {
            if (s !== slug) return;
            setLists(prev => prev.map(it =>
                it.id === list.id
                    ? {
                        ...it,
                        text: list.title ?? it.text,
                        description: list.description ?? it.description,
                        done: list.status ? list.status === "archived" : it.done,
                    }
                    : it
            ));
        };

        const onDeleted = ({ slug: s, id }) => {
            if (s !== slug) return;
            setLists(prev => prev.filter(it => it.id !== id));
        };

        // ✅ เมื่อเจ้าของแก้ไขหัวข้อ (title/description) ให้หน้าอัปเดตทันที
        const onTopicUpdated = ({ topic: t, slug: s }) => {
            // ถ้า server ใส่ slug มาก็กรองด้วย slug ก่อน
            if (s && s !== slug) return;
            // ต้องมี topic.id ให้เทียบ (ถ้าไม่มี slug)
            if (t?.id && topic?.id && t.id !== topic.id) return;
            setTopic(prev => prev ? {
                ...prev,
                // อัปเดตเฉพาะฟิลด์ที่ส่งมา (กัน null/undefined ทับของเก่าโดยไม่ตั้งใจ)
                ...(typeof t.title !== "undefined" ? { title: t.title } : {}),
                ...(typeof t.description !== "undefined" ? { description: t.description ?? "" } : {}),
            } : prev);
        };

        const onUserProfile = ({ slug: s, userId, profile_image, url }) => {
            if (s && s !== slug) return;
            if (!userId) return;

            // อัปเดตฟิลด์โปรไฟล์ใน members
            setMembers(prev =>
                prev.map(m => String(m.id) === String(userId)
                    ? { ...m, profile_image: typeof profile_image !== "undefined" ? profile_image : m.profile_image }
                    : m
                )
            );

            // เก็บ URL ที่มี cache-bust
            if (url) setAvatarUrlMap(prev => ({ ...prev, [userId]: url }));
        };

        const onMeProfile = ({ userId, profile_image, url }) => {
            if (!userId) return;
            setMembers(prev =>
                prev.map(m => String(m.id) === String(userId)
                    ? { ...m, profile_image: typeof profile_image !== "undefined" ? profile_image : m.profile_image }
                    : m
                )
            );
            if (url) setAvatarUrlMap(prev => ({ ...prev, [userId]: url }));
        };

        socket.on("members:added", onMemberAdded);
        socket.on("lists:created", onCreated);
        socket.on("lists:updated", onUpdated);
        socket.on("lists:deleted", onDeleted);
        socket.on("topics:updated", onTopicUpdated);
        socket.on("users:profile", onUserProfile);
        socket.on("me:profile", onMeProfile);

        return () => {
            socket.emit("leave:topic", slug);
            socket.off("members:added", onMemberAdded);
            socket.off("lists:created", onCreated);
            socket.off("lists:updated", onUpdated);
            socket.off("lists:deleted", onDeleted);
            socket.off("topics:updated", onTopicUpdated);
            socket.off("users:profile", onUserProfile);
            socket.off("me:profile", onMeProfile);
        };
    }, [slug, topic?.id]);

    const openEdit = (idx) => {
        const it = lists[idx];
        if (!it) return;
        setEditIndex(idx);
        setEditTitle(it.text || "");
        setEditDesc(it.description || "");
        setEditOpen(true);
    };

    const closeEdit = () => {
        if (editLoading) return;
        setEditOpen(false);
        setEditIndex(-1);
        setEditTitle("");
        setEditDesc("");
    };

    const openView = (idx) => {
        setViewIndex(idx);
        setViewOpen(true);
    };

    const closeView = () => {
        setViewOpen(false);
        setViewIndex(-1);
    };

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

    const createInvite = async () => {
        if (!isOwner) {
            return Swal.fire({
                toast: true,
                position: "top",
                icon: "error",
                title: "คุณไม่ใช่เจ้าของหัวข้อนี้",
                showConfirmButton: false,
                timer: 2000,
            });
        }
        try {
            const res = await fetch(`${API_BASE}/topics/${slug}/invites`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ maxUses: 1, expiresInDays: 1 }),
            });
            if (res.status === 401) return (window.location.href = "/login?next=/home/" + slug);
            if (res.status === 403) {
                return Swal.fire({
                    toast: true,
                    position: "top",
                    icon: "error",
                    title: "เฉพาะเจ้าของหัวข้อเท่านั้น",
                    showConfirmButton: false,
                    timer: 2000,
                });
            }

            const json = await res.json();
            if (!json.ok) {
                return Swal.fire({
                    toast: true,
                    position: "top",
                    icon: "error",
                    title: "สร้างลิงก์ไม่สำเร็จ",
                    showConfirmButton: false,
                    timer: 2000,
                });
            }

            // เปิดป๊อปอัป QR + ปุ่มคัดลอก
            setInviteUrl(json.data.invite_url);
            setInviteOpen(true);

            // รีเฟรชรายการ invite ของ owner
            const r2 = await fetch(`${API_BASE}/topics/${slug}/invites`, { credentials: "include" });
            const j2 = await r2.json();
            if (j2.ok) setInvites(j2.data);
        } catch (e) {
            console.error(e);
            Swal.fire({
                toast: true,
                position: "top",
                icon: "error",
                title: "สร้างลิงก์ไม่สำเร็จ",
                showConfirmButton: false,
                timer: 2000,
            });
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
                        description: r.description ?? "",
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

    const handleCreateList = useCallback(async () => {
        const title = newListTitle.trim();
        if (!title) return;

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/topics/${slug}/lists`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ title, description: newListDesc || null }),
            });
            if (res.status === 401) return (window.location.href = "/login?next=/home/" + slug);
            if (res.status === 403) {
                setLoading(false);
                return Swal.fire({ icon: "error", title: "ไม่มีสิทธิ์" }); // หรือจะแจ้งใน UI เองก็ได้
            }
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

            setIsAddOpen(false);
            setNewListTitle("");
            setNewListDesc("");
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [slug, newListTitle, newListDesc]);

    const toggleDone = useCallback(async (index) => {
        const item = lists[index];
        if (!item) return;
        const nextDone = !item.done;

        // อัปเดตแบบ optimistic
        setLists(prev => prev.map((it, i) => i === index ? { ...it, done: nextDone } : it));

        try {
            const res = await fetch(`${API_BASE}/lists/${item.id}/status`, {
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

    const handleCloseAdd = useCallback(() => {
        if (!loading) {
            setIsAddOpen(false);
            setNewListTitle("");
            setNewListDesc(""); // ล้าง desc ด้วย (แถม)
        }
    }, [loading]);

    // ⬇️ วางใน TopicPage() หลังจากประกาศ state ที่เกี่ยวกับ edit แล้ว
    const handleEditSubmit = useCallback(async () => {
        const idx = editIndex;
        const item = lists[idx];
        if (!item) return;

        const newTitle = (editTitle || "").trim();
        const newDesc = (editDesc || "").trim();
        if (!newTitle) return;

        setEditLoading(true);
        try {
            const res = await fetch(`${API_BASE}/lists/${item.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    title: newTitle,
                    description: newDesc || null,
                }),
            });

            if (res.status === 401) {
                window.location.href = "/login?next=/home/" + slug;
                return;
            }
            if (res.status === 403) {
                Swal.fire({ toast: true, position: "top", icon: "error", title: "ไม่มีสิทธิ์", showConfirmButton: false, timer: 1600 });
                return;
            }

            const json = await res.json();
            if (!json.ok) {
                const msg = json.error === "DUPLICATE_TITLE" ? "ชื่อนี้มีอยู่แล้ว" : "บันทึกไม่สำเร็จ";
                Swal.fire({ toast: true, position: "top", icon: "error", title: msg, showConfirmButton: false, timer: 1600 });
                return;
            }

            // อัปเดต state ในหน้า
            setLists(prev =>
                prev.map((it, i) =>
                    i === idx ? { ...it, text: newTitle, description: newDesc || "" } : it
                )
            );

            // ปิด modal + แจ้งเตือน
            setEditOpen(false);
            setEditIndex(-1);
            Swal.fire({ toast: true, position: "top", icon: "success", title: "บันทึกแล้ว", showConfirmButton: false, timer: 1200 });
        } catch (err) {
            console.error(err);
            Swal.fire({ toast: true, position: "top", icon: "error", title: "บันทึกไม่สำเร็จ", showConfirmButton: false, timer: 1600 });
        } finally {
            setEditLoading(false);
        }
    }, [API_BASE, slug, lists, editIndex, editTitle, editDesc]);

    const handleDelete = useCallback(async (index) => {
        const item = lists[index];
        if (!item) return;

        // confirm ลบ (ใช้ swal แบบยืนยัน)
        const ok = await Swal.fire({
            title: "ลบรายการนี้?",
            text: `“${item.text}” จะถูกลบถาวร`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "ลบ",
            cancelButtonText: "ยกเลิก",
            confirmButtonColor: "#ef4444",
        }).then(r => r.isConfirmed);

        if (!ok) return;

        setDeletingId(item.id);

        // optimistic remove
        const prev = lists;
        setLists(prev => prev.filter((_, i) => i !== index));

        try {
            const res = await fetch(`${API_BASE}/lists/${item.id}`, {
                method: "DELETE",
                credentials: "include",
            });

            if (res.status === 401) {
                window.location.href = "/login?next=/home/" + slug;
                return;
            }
            if (res.status === 403) {
                // rollback
                setLists(prev);
                Swal.fire({ toast: true, position: "top", icon: "error", title: "ไม่มีสิทธิ์", showConfirmButton: false, timer: 1600 });
                return;
            }
            if (!res.ok) {
                // rollback
                setLists(prev);
                Swal.fire({ toast: true, position: "top", icon: "error", title: "ลบไม่สำเร็จ", showConfirmButton: false, timer: 1600 });
                return;
            }

            Swal.fire({ toast: true, position: "top", icon: "success", title: "ลบแล้ว", showConfirmButton: false, timer: 1200 });
        } catch (err) {
            console.error(err);
            setLists(prev); // rollback
            Swal.fire({ toast: true, position: "top", icon: "error", title: "ลบไม่สำเร็จ", showConfirmButton: false, timer: 1600 });
        } finally {
            setDeletingId(null);
        }
    }, [lists, slug]);

    const { total, doneCount, percent } = useMemo(() => {
        const t = lists.length;
        const d = lists.reduce((acc, it) => acc + (it.done ? 1 : 0), 0);
        return {
            total: t,
            doneCount: d,
            percent: t ? Math.round((d * 100) / t) : 0,
        };
    }, [lists]);

    if (!topic) return <div className={styles.loading}><h1 className={styles.title}>กำลังโหลด...</h1></div>;

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
                    <button
                        type="button"
                        className={styles.addBtn}
                        onClick={() => setIsAddOpen(true)}
                        disabled={loading}
                    >
                        <FaPlus /> เพิ่มลิสต์
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
                                src={
                                    avatarUrlMap[m.id]                                  // ถ้ามี URL ที่ bust cache ให้ใช้ก่อน
                                    || (m.profile_image && toImgSrc(m.profile_image))   // fallback: path จาก DB
                                    || `https://i.pravatar.cc/40?u=${m.id}`             // สำรองสุดท้าย
                                }
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
                            <FaPlus /> สร้างลิงก์เชิญ
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
                        {editMode ? (
                            <>
                                <FaCheck />
                                เสร็จสิ้น
                            </>
                        ) : (
                            <>
                                <FaPen /> แก้ไข
                            </>
                        )}
                    </button>
                </div>

                <div
                    className={styles.progress}
                    role="progressbar"
                    aria-valuenow={percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="ความคืบหน้าลิสต์ทั้งหมด"
                    title={`เสร็จแล้ว ${doneCount}/${total} • ${percent}%`}
                >
                    <div className={styles.progressBar} style={{ width: `${percent}%` }}>
                        {percent}%
                    </div>
                </div>

                {topic?.description && (
                    <p className={styles.topicDescription}>{topic.description}</p>
                )}

                {lists.length === 0 ? (
                    <p className={styles.empty}>ยังไม่มีลิสต์ ✨</p>
                ) : (
                    <ul className={styles.list}>
                        {lists.map((item, idx) => (
                            <li
                                key={item.id}
                                className={`${styles.listItem} ${item.done ? styles.done : ""}`}
                                onClick={!editMode ? () => openView(idx) : undefined}
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
                                            onClick={() => openEdit(idx)}         // <-- เปลี่ยนตรงนี้
                                            aria-label="แก้ไขรายการ"
                                            title="แก้ไข"
                                        >
                                            <FaPen />
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.actionBtn}
                                            onClick={() => handleDelete(idx)}
                                            aria-label="ลบรายการ"
                                            title="ลบ"
                                        >
                                            <FaTrash />
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
                avatarUrlMap={avatarUrlMap}
            />

            <ViewListModal
                open={viewOpen}
                onClose={closeView}
                item={viewIndex >= 0 ? lists[viewIndex] : null}
                onComplete={async () => {
                    // reuse toggleDone ที่มีอยู่
                    await toggleDone(viewIndex);
                    closeView();
                    Swal.fire({ toast: true, position: "top", icon: "success", title: "ทำเสร็จแล้ว", showConfirmButton: false, timer: 1300 });
                }}
            />

            <ListModal
                open={isAddOpen}
                onClose={handleCloseAdd}
                mode="add"
                titleValue={newListTitle}
                descValue={newListDesc}
                onTitleChange={setNewListTitle}
                onDescChange={setNewListDesc}
                onSubmit={handleCreateList}
                loading={loading}
            />

            <ListModal
                open={editOpen}
                onClose={closeEdit}
                mode="edit"
                titleValue={editTitle}
                descValue={editDesc}
                onTitleChange={setEditTitle}
                onDescChange={setEditDesc}
                onSubmit={handleEditSubmit}
                loading={editLoading}
            />

            <InviteModal
                open={inviteOpen}
                onClose={() => setInviteOpen(false)}
                url={inviteUrl}
            />

        </div>
    );
}

function ListModal({
    open,
    onClose,
    mode = "add", // "add" | "edit"
    titleValue,
    descValue,
    onTitleChange,
    onDescChange,
    onSubmit,
    loading,
}) {
    const dialogId = mode === "add" ? "add-list-title" : "edit-list-title";
    const inputRef = useRef(null);
    const closeBtnRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
        document.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        // focus เฉพาะตอนแรก
        queueMicrotask(() => inputRef.current?.focus());

        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [open]);

    if (!open) return null;

    return (
        <div className={styles.modalOverlay} onClick={() => !loading && onClose?.()}>
            <div
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby={dialogId}
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.modalHeader}>
                    <h3 id={dialogId}>{mode === "add" ? "เพิ่มลิสต์ใหม่" : "แก้ไขลิสต์"}</h3>
                    <button
                        type="button"
                        className={styles.modalClose}
                        onClick={() => !loading && onClose?.()}
                        ref={closeBtnRef}
                    >
                        ✕
                    </button>
                </div>

                <form
                    className={styles.modalBody}
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!loading && titleValue.trim()) onSubmit?.();
                    }}
                >
                    <label className={styles.label} htmlFor="list-title">ชื่อรายการ</label>
                    <input
                        id="list-title"
                        ref={inputRef}
                        className={styles.input}
                        type="text"
                        placeholder="เช่น จัดกระเป๋า / ทำวีซ่า"
                        value={titleValue}
                        onChange={(e) => onTitleChange?.(e.target.value)}
                        disabled={loading}
                    />

                    <label className={styles.label} htmlFor="list-desc" style={{ marginTop: 12 }}>
                        คำอธิบาย (ไม่บังคับ)
                    </label>
                    <textarea
                        id="list-desc"
                        className={styles.textarea}
                        placeholder="รายละเอียดเพิ่มเติม"
                        value={descValue}
                        onChange={(e) => onDescChange?.(e.target.value)}
                        disabled={loading}
                        rows={3}
                    />

                    <div className={styles.modalActions}>
                        <button type="submit" className={styles.confirmBtn} disabled={!titleValue.trim() || loading}>
                            {loading ? "กำลังบันทึก..." : (mode === "add" ? "เพิ่มรายการ" : "บันทึกการแก้ไข")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function ViewListModal({ open, onClose, item, onComplete }) {
    const dialogId = "view-list-title";
    const overlayRef = useRef(null);
    const closeBtnRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
        document.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        queueMicrotask(() => closeBtnRef.current?.focus());
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [open, onClose]);

    if (!open || !item) return null;

    return (
        <div
            ref={overlayRef}
            className={styles.modalOverlay}
            onClick={onClose}
            aria-hidden={!open}
        >
            <div
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby={dialogId}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                    if (e.key !== "Tab") return;
                    const focusables = Array.from(
                        e.currentTarget.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
                    ).filter(el => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
                    if (focusables.length === 0) return;
                    const first = focusables[0];
                    const last = focusables[focusables.length - 1];
                    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
                }}
            >
                <div className={styles.modalHeader}>
                    <h3 id={dialogId}>{item.text}</h3>
                </div>

                <div className={styles.modalBody}>
                    {/* สเตตัสชิปเล็กๆ */}
                    <div className={styles.statusRow}>
                        <span className={`${styles.statusChip} ${item.done ? styles.statusDone : styles.statusActive}`}>
                            {item.done ? "เสร็จแล้ว" : "ยังไม่เสร็จ"}
                        </span>
                    </div>

                    {/* รายละเอียด (มีหรือไม่มีก็โชว์ให้ชัด) */}
                    {item.description?.trim() ? (
                        <p className={styles.listDescription}>{item.description}</p>
                    ) : (
                        <p className={styles.listDescription} style={{ opacity: .7 }}>— ไม่มีรายละเอียด —</p>
                    )}
                </div>

                <div className={styles.modalActions}>
                    {!item.done && (
                        <button
                            type="button"
                            className={styles.confirmBtn}
                            onClick={onComplete}
                        >
                            ทำเสร็จแล้ว
                        </button>
                    )}
                    <button
                        type="button"
                        className={styles.cancelBtn}
                        onClick={onClose}
                    >
                        ปิด
                    </button>
                </div>
            </div>
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
    avatarUrlMap = {},
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
                    <h3 id={dialogId}>สมาชิกทั้งหมด ( {members.length} )</h3>
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
                                        src={
                                            avatarUrlMap[m.id]
                                            || (m.profile_image && toImgSrc(m.profile_image))
                                            || `https://i.pravatar.cc/100?u=${m.id}`
                                        }
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

function InviteModal({ open, onClose, url }) {
    const dialogId = "invite-modal-title";
    const inputRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
        document.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [open, onClose]);

    if (!open) return null;

    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(url || "")}`;

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(url);
            Swal.fire({ toast: true, position: "top", icon: "success", title: "คัดลอกลิงก์แล้ว", showConfirmButton: false, timer: 1500 });
        } catch {
            Swal.fire({ toast: true, position: "top", icon: "error", title: "คัดลอกไม่สำเร็จ", showConfirmButton: false, timer: 1500 });
        }
    };

    const shareLink = async () => {
        if (navigator.share) {
            try {
                await navigator.share({ title: "ชวนเข้าหัวข้อ", text: "กดเพื่อเข้าร่วม", url });
            } catch { /* cancel */ }
        } else {
            copyLink();
        }
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby={dialogId}
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.modalHeader}>
                    <h3 id={dialogId}>ลิงก์เชิญ</h3>
                    <button type="button" className={styles.modalClose} onClick={onClose}>✕</button>
                </div>

                <div className={styles.modalBody} style={{ textAlign: "center" }}>
                    {/* QR Code */}
                    <img
                        src={qrSrc}
                        alt="QR Invite"
                        className={styles.qrImage}
                        width={240}
                        height={240}
                    />

                    {/* ลิงก์ */}
                    <div style={{ marginTop: 12 }}>
                        <input
                            ref={inputRef}
                            className={styles.input}
                            type="text"
                            readOnly
                            value={url || ""}
                            onFocus={(e) => e.target.select()}
                        />
                    </div>

                    <p style={{ marginTop: 8, opacity: .7, fontSize: 14 }}>
                        ลิงก์นี้ใช้ได้ 1 คน / 24 ชม.
                    </p>
                </div>

                <div className={styles.modalActions}>
                    <a
                        href={qrSrc}
                        download="invite-qr.png"
                        className={styles.secondaryBtn ?? styles.cancelBtn}
                        style={{ textDecoration: "none", textAlign: "center" }}
                    >
                        ดาวน์โหลด QR
                    </a>
                    <button type="button" className={styles.secondaryBtn ?? styles.cancelBtn} onClick={shareLink}>
                        แชร์
                    </button>
                    <button type="button" className={styles.confirmBtn} onClick={copyLink}>
                        คัดลอกลิงก์
                    </button>
                </div>
            </div>
        </div>
    );
}