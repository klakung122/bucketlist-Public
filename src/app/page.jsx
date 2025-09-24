"use client";
import styles from "@/styles/page.module.css";
import Link from "next/link";

export default function Page() {
    return (
        <div className={styles.container}>
            <nav className={styles.navbar} aria-label="Main">
                <h1 className={styles.logo}>Bucketlist</h1>
                <div className={styles.navLinks}>
                    <Link href="/register" className={`${styles.btn} ${styles.primary}`}>ลงทะเบียน</Link>
                    <Link href="/login" className={`${styles.btn} ${styles.outline}`}>ลงชื่อเข้าใช้</Link>
                </div>
            </nav>

            <main className={styles.hero}>
                <h2>แชร์ Bucket List ของคุณกับเพื่อนได้ง่ายๆ</h2>
                <p>คุณสามารถสร้างหัวข้อของตัวเองได้ และยังสามารถเชิญเพื่อนๆ เข้ามาร่วมตั้งเป้าหมายด้วยกัน พร้อมแสดงอัตราความคืบหน้าของแต่ละรายการ</p>
                <Link href="/home" className={`${styles.btn} ${styles.big}`}>
                    เริ่มต้นใช้งาน ✨
                </Link>

                <div className={styles.progressDemo}>
                    <h3>ตัวอย่างความคืบหน้า</h3>
                    <div className={styles.progress}>
                        <div className={styles.progressBar} style={{ width: "60%" }}>60%</div>
                    </div>
                </div>
            </main>
        </div>
    );
}