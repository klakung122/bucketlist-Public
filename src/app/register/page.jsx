import Link from "next/link";
import styles from "@/styles/register.module.css";

export default function RegisterPage() {
    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <h1 className={styles.title}>✨ สมัครสมาชิก ✨</h1>
                <p className={styles.subtitle}>สร้างบัญชีใหม่ของคุณเพื่อเริ่มต้น Bucketlist</p>

                <form className={styles.form}>
                    <input type="text" placeholder="ชื่อผู้ใช้" className={styles.input} required />
                    <input type="email" placeholder="อีเมล" className={styles.input} required />
                    <input type="password" placeholder="รหัสผ่าน" className={styles.input} required />
                    <input type="password" placeholder="ยืนยันรหัสผ่าน" className={styles.input} required />

                    <button type="submit" className={styles.submitBtn}>
                        ลงทะเบียน
                    </button>
                </form>

                <p className={styles.switch}>
                    มีบัญชีแล้ว?{" "}
                    <Link href="/login" className={styles.link}>
                        เข้าสู่ระบบ
                    </Link>
                </p>
            </div>
        </div>
    );
}