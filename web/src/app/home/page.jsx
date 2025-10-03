"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import styles from "@/styles/home.module.css";
import { FaPlus } from "react-icons/fa";
import { API_BASE } from "@/lib/api";
import { socket } from "@/lib/socket";

export default function HomePage() {
    const [topics, setTopics] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [newTopic, setNewTopic] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [loading, setLoading] = useState(false);
    const inputRef = useRef(null);

    // โหลดรายการหัวข้อจาก API
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/topics`, { credentials: "include" });
                const json = await res.json();
                if (!alive) return;
                if (json.ok) setTopics(json.data); // เก็บทั้ง object
            } catch (e) {
                console.error(e);
            }
        })();
        return () => { alive = false; };
    }, []);

    // 🎧 ฟัง socket อัปเดตรายการหัวข้อแบบเรียลไทม์
    useEffect(() => {
        if (!socket.connected) socket.connect();

        // กันซ้ำ + upsert ชัด ๆ
        const upsert = (list, item) => {
            const i = list.findIndex(t => t.id === item.id);
            if (i === -1) return [item, ...list];
            const merged = { ...list[i], ...item };
            return [merged, ...list.filter((_, idx) => idx !== i)];
        };

        const onCreated = ({ topic }) => {
            setTopics(prev => {
                if (prev.some(t => t.id === topic.id)) return prev;
                return [topic, ...prev];
            });
        };
        const onUpdated = ({ topic }) => {
            setTopics(prev => upsert(prev, topic));
        };
        const onDeleted = ({ id }) => {
            setTopics(prev => prev.filter(t => t.id !== id));
        };

        socket.on("topics:created", onCreated);
        socket.on("topics:updated", onUpdated);
        socket.on("topics:deleted", onDeleted);
        return () => {
            socket.off("topics:created", onCreated);
            socket.off("topics:updated", onUpdated);
            socket.off("topics:deleted", onDeleted);
        };
    }, []);

    useEffect(() => {
        if (isOpen) {
            const id = requestAnimationFrame(() => inputRef.current?.focus());
            return () => cancelAnimationFrame(id);
        }
    }, [isOpen]);

    const openModal = () => setIsOpen(true);
    const closeModal = useCallback(() => {
        setIsOpen(false);
        setNewTopic("");
        setNewDesc("");
        setLoading(false);
    }, []);

    const handleAdd = useCallback(async () => {
        const title = newTopic.trim();
        const description = newDesc.trim();   // ตัดช่องว่าง
        if (!title) return;

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/topics`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ title, description: description || null }), // ส่ง null ถ้าว่าง
            });
            const json = await res.json();
            if (!json.ok) {
                console.error(json);
                setLoading(false);
                return;
            }
            closeModal();
        } catch (e) {
            console.error(e);
            setLoading(false);
        }
    }, [newTopic, newDesc, closeModal]); // << เพิ่ม newDesc

    const onKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleAdd();
        } else if (e.key === "Escape") {
            e.preventDefault();
            closeModal();
        }
    };

    return (
        <div className={styles.container}>
            {/* Box: Create */}
            <div className={styles.box}>
                <h2 className={styles.boxTitle}>สร้างหัวข้อใหม่</h2>
                <button onClick={openModal} className={styles.addBtn}>
                    <FaPlus /> สร้างหัวข้อ
                </button>
            </div>

            {/* Box: Topics List */}
            <div className={styles.box}>
                <h2 className={styles.boxTitle}>รายการหัวข้อ</h2>
                {topics.length === 0 ? (
                    <p className={styles.empty}>ยังไม่มีหัวข้อ ✨</p>
                ) : (
                    <ul className={styles.list}>
                        {topics.map((t) => (
                            <li key={t.id} className={styles.item}>
                                <Link href={`/home/${t.slug}`} className={styles.topicLink}>
                                    {t.title}
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Modal */}
            {isOpen && (
                <div
                    className={styles.modalOverlay}
                    onClick={closeModal}
                    aria-hidden={!isOpen}
                >
                    <div
                        className={styles.modal}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="createTopicTitle"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                            // ---- Tab focus trap (แบบเดียวกับอันบน) ----
                            if (e.key === "Tab") {
                                const focusables = Array.from(
                                    e.currentTarget.querySelectorAll(
                                        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                                    )
                                ).filter(
                                    (el) =>
                                        !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden")
                                );
                                if (focusables.length === 0) return;
                                const first = focusables[0];
                                const last = focusables[focusables.length - 1];
                                if (e.shiftKey && document.activeElement === first) {
                                    e.preventDefault();
                                    last.focus();
                                } else if (!e.shiftKey && document.activeElement === last) {
                                    e.preventDefault();
                                    first.focus();
                                }
                                return;
                            }

                            // ---- ช็อตคัตส่งด้วย Ctrl/Cmd+Enter ----
                            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                                e.preventDefault();
                                if (!loading && newTopic.trim()) handleAdd();
                            }
                        }}
                    >
                        {/* Header รูปแบบเดียวกับอันบน */}
                        <div className={styles.modalHeader}>
                            <h3 id="createTopicTitle">สร้างหัวข้อใหม่</h3>
                            <button
                                type="button"
                                className={styles.modalClose}
                                aria-label="ปิดหน้าต่าง"
                                title="ปิด"
                                onClick={closeModal}
                                disabled={loading}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Body เป็น form + label/input/textarea + actions แบบเดียวกัน */}
                        <form
                            className={styles.modalBody}
                            onSubmit={(e) => {
                                e.preventDefault();
                                if (!loading && newTopic.trim()) handleAdd();
                            }}
                        >
                            <label className={styles.label} htmlFor="topic-title">
                                ชื่อหัวข้อ
                            </label>
                            <input
                                id="topic-title"
                                ref={inputRef}
                                type="text"
                                value={newTopic}
                                onChange={(e) => setNewTopic(e.target.value)}
                                placeholder="พิมพ์ชื่อหัวข้อ..."
                                className={styles.input}
                                autoComplete="off"
                                spellCheck={false}
                                autoFocus
                                disabled={loading}
                            />

                            <label
                                className={styles.label}
                                htmlFor="topic-desc"
                                style={{ marginTop: 12 }}
                            >
                                รายละเอียดเพิ่มเติม (ไม่บังคับ)
                            </label>
                            <textarea
                                id="topic-desc"
                                value={newDesc}
                                onChange={(e) => setNewDesc(e.target.value)}
                                placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)"
                                className={styles.textarea}
                                disabled={loading}
                                rows={3}
                            />

                            <div className={styles.modalActions}>
                                <button
                                    className={styles.confirmBtn}
                                    type="submit"
                                    disabled={!newTopic.trim() || loading}
                                >
                                    {loading ? "กำลังเพิ่ม..." : "เพิ่มหัวข้อ"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}