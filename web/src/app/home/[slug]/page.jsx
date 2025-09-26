"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Swal from "sweetalert2";
import { FaPlus, FaCheck } from "react-icons/fa";
import { MdOutlineChecklist } from "react-icons/md";
import styles from "@/styles/topic.module.css";
import { API_BASE } from "@/lib/api";

export default function TopicPage() {
    const { slug } = useParams();

    const [lists, setLists] = useState([]); // {id, text, done}
    const [loading, setLoading] = useState(false);
    const [topic, setTopic] = useState(null);

    // โหลด lists ของหัวข้อนี้
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/topics/${slug}/lists`, { credentials: "include" });
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
                const json = await res.json();
                if (json.ok) setTopic(json.data);
            } catch (err) {
                console.error(err);
            }
        })();
    }, [slug]);

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

            <section className={styles.box}>
                <div className={styles.boxTitleCon}>
                    <h2 className={styles.boxTitle}>ลิสต์ทั้งหมด</h2>
                    <button type="button" className={styles.editBtn}>✏️ แก้ไข</button>
                </div>

                {lists.length === 0 ? (
                    <p className={styles.empty}>ยังไม่มีลิสต์ ✨</p>
                ) : (
                    <ul className={styles.list}>
                        {lists.map((item, idx) => (
                            <li
                                key={item.id}
                                className={`${styles.listItem} ${item.done ? styles.done : ""}`}
                                onClick={() => toggleDone(idx)}
                            >
                                <span className={styles.circle}>
                                    {item.done && <FaCheck className={styles.checkIcon} />}
                                </span>
                                <span>{item.text}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}