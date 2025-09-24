"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";
import { FaPlus, FaCheck } from "react-icons/fa";
import { MdOutlineChecklist } from "react-icons/md";
import styles from "@/styles/topic.module.css";

export default function TopicPage() {
    const { id } = useParams();
    const [item, setItem] = useState("");
    const [lists, setLists] = useState([
        { text: "หาข้อมูล / วางแผน", done: false },
        { text: "กำหนดงบประมาณ", done: true },
        { text: "จองตั๋ว / ติดต่อเพื่อน", done: false },
    ]);

    const toggleDone = (index) => {
        setLists((prev) =>
            prev.map((item, i) =>
                i === index ? { ...item, done: !item.done } : item
            )
        );
    };

    const addList = (e) => {
        e?.preventDefault();
        const val = item.trim();
        if (!val) return;
        setLists((prev) => [val, ...prev]);
        setItem("");
        Swal.fire({
            icon: "success",
            title: "เพิ่มลิสต์แล้ว!",
            text: `"${val}" ถูกเพิ่มเรียบร้อย 🎉`,
            confirmButtonText: "โอเค",
            confirmButtonColor: "#ec4899",
        });
    };

    const onClickList = (text) => {
        Swal.fire({
            icon: "success",
            title: "ทำสำเร็จ!",
            text: `รายการ: "${text}"`,
            confirmButtonText: "เย้ ✨",
            confirmButtonColor: "#60a5fa",
        });
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <Link href="/home" className={styles.back}>{`← กลับหน้า Home`}</Link>
                <h1 className={styles.title}>
                    <MdOutlineChecklist /> หัวข้อ #{id}
                </h1>
            </header>

            <section className={styles.box}>
                <h2 className={styles.boxTitle}>จัดการลิสต์</h2>
                <div className={styles.actionGroup}>
                    <button type="button" className={styles.addBtn}>
                        <FaPlus /> เพิ่ม
                    </button>
                </div>
            </section>

            {/* Invite Friends */}
            <section className={styles.box}>
                <h2 className={styles.boxTitle}>เชิญเพื่อน</h2>
                <div className={styles.inviteRow}>
                    <div className={styles.avatars}>
                        <img src="https://i.pravatar.cc/40?img=1" alt="friend1" />
                        <img src="https://i.pravatar.cc/40?img=2" alt="friend2" />
                        <img src="https://i.pravatar.cc/40?img=3" alt="friend3" />
                    </div>
                    <button className={styles.inviteBtn}><FaPlus /> เชิญเพื่อน</button>
                </div>
            </section>

            {/* Lists */}
            <section className={styles.box}>
                <div className={styles.boxTitleCon}>
                    <h2 className={styles.boxTitle}>ลิสต์ทั้งหมด</h2>
                    <button type="button" className={styles.editBtn}>
                        ✏️ แก้ไข
                    </button>
                </div>
                {lists.length === 0 ? (
                    <p className={styles.empty}>ยังไม่มีลิสต์ ✨</p>
                ) : (
                    <ul className={styles.list}>
                        {lists.map((item, idx) => (
                            <li
                                key={idx}
                                className={`${styles.listItem} ${item.done ? styles.done : ""
                                    }`}
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