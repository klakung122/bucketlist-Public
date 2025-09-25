import Link from "next/link";
import styles from "@/styles/login.module.css";

export default function LoginPage() {
    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <h1 className={styles.title}>🌸 เข้าสู่ระบบ 🌸</h1>
                <p className={styles.subtitle}>ยินดีต้อนรับกลับมา!</p>

                <form className={styles.form}>
                    <input type="email" placeholder="อีเมล" className={styles.input} required />
                    <input type="password" placeholder="รหัสผ่าน" className={styles.input} required />

                    <button type="submit" className={styles.submitBtn}>
                        เข้าสู่ระบบ
                    </button>
                </form>

                <p className={styles.switch}>
                    ยังไม่มีบัญชี?{" "}
                    <Link href="/register" className={styles.link}>
                        สมัครสมาชิก
                    </Link>
                </p>
            </div>
        </div>
    );
}