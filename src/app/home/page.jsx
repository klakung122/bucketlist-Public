"use client";
import { useState } from "react";
import Link from "next/link";
import styles from "@/styles/home.module.css";
import { FaPlus } from "react-icons/fa";

export default function HomePage() {
    const [topics, setTopics] = useState([
        "ไปเที่ยวญี่ปุ่น",
        "เรียน React ให้จบ",
        "ออกกำลังกาย 3 ครั้ง/สัปดาห์"
    ]);

    const addTopic = () => {
        const newTopic = prompt("กรอกชื่อหัวข้อใหม่:");
        if (newTopic && newTopic.trim() !== "") {
            setTopics([...topics, newTopic.trim()]);
        }
    };

    return (
        <div className={styles.container}>
            {/* Box: Create */}
            <div className={styles.box}>
                <h2 className={styles.boxTitle}>สร้างหัวข้อใหม่</h2>
                <button onClick={addTopic} className={styles.addBtn}>
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
                        {topics.map((topic, i) => (
                            <li key={i} className={styles.item}>
                                <Link href={`/home/${i}`} className={styles.topicLink}>
                                    {topic}
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}