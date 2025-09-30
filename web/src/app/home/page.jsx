"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import styles from "@/styles/home.module.css";
import { FaPlus } from "react-icons/fa";
import { API_BASE } from "@/lib/api";

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
            setTopics(prev => [json.data, ...prev]);
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
                <div className={styles.modalOverlay} onClick={closeModal} aria-hidden={!isOpen}>
                    <div
                        className={styles.modal}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="createTopicTitle"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={onKeyDown}
                    >
                        <button className={styles.closeBtn} aria-label="ปิด" onClick={closeModal} type="button">
                            ×
                        </button>

                        <h3 id="createTopicTitle" className={styles.modalTitle}>
                            สร้างหัวข้อใหม่
                        </h3>

                        <input
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

                        <textarea
                            value={newDesc}
                            onChange={(e) => setNewDesc(e.target.value)}
                            placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)"
                            className={styles.textarea}
                            disabled={loading}
                        />

                        <button
                            onClick={handleAdd}
                            className={styles.confirmBtn}
                            type="button"
                            disabled={!newTopic.trim() || loading}
                        >
                            {loading ? "กำลังเพิ่ม..." : "เพิ่มหัวข้อ"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}