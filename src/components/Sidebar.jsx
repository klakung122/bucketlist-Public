"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiSettings, FiLogOut, FiHome, FiX } from "react-icons/fi";
import { MdOutlineChecklist } from "react-icons/md";
import s from "@/styles/sidebar.module.css";

const mockTopics = [
    { id: 1, name: "ไปเที่ยวญี่ปุ่น" },
    { id: 2, name: "เรียน React ให้จบ" },
    { id: 3, name: "ออกกำลังกาย 3 ครั้ง/สัปดาห์" },
];

export default function Sidebar({ isOpen = false, isMobile = false, onClose = () => { } }) {
    const pathname = usePathname();
    const isActive = (href) => pathname === href || pathname?.startsWith(href + "/");

    const onLogout = () => {
        if (confirm("ต้องการออกจากระบบใช่ไหม?")) {
            window.location.href = "/login";
        }
    };

    return (
        <>
            {/* Backdrop เฉพาะมือถือ */}
            <div
                className={`${s.backdrop} ${isMobile && isOpen ? s.backdropShow : ""}`}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* สำคัญ: ไม่ใช้ aria-hidden ปิดทั้ง aside; ใช้ inert แทน */}
            <aside
                id="sidebar"
                className={`${s.sidebar} ${isMobile && isOpen ? s.open : ""}`}
                inert={isMobile && !isOpen}   // ✅ เดสก์ท็อป inert=false เสมอ → คลิกได้
                role="navigation"
                aria-label="Sidebar"
            >
                {/* ปุ่มปิดแสดงเฉพาะตอนเปิด ป้องกันโฟกัสค้าง */}
                {isMobile && isOpen && (
                    <button className={s.closeBtn} onClick={onClose} aria-label="ปิดเมนู">
                        <FiX />
                    </button>
                )}

                {/* Profile */}
                <div className={s.profile}>
                    <img src="https://i.pravatar.cc/96?img=5" alt="โปรไฟล์" className={s.avatar} />
                    <div>
                        <div className={s.name}>Watcharakon</div>
                        <div className={s.email}>you@example.com</div>
                    </div>
                </div>

                {/* Main nav */}
                <nav className={s.nav}>
                    <Link href="/home" className={`${s.navItem} ${isActive("/home") ? s.active : ""}`}>
                        <FiHome />
                        <span>หน้า Home</span>
                    </Link>
                </nav>

                {/* Topics */}
                <div className={s.sectionTitle}>
                    <MdOutlineChecklist />
                    <span>หัวข้อของฉัน</span>
                </div>
                <ul className={s.topicList}>
                    {mockTopics.map((t) => (
                        <li key={t.id}>
                            <Link
                                href={`/home/${t.id}`}
                                className={`${s.topicItem} ${isActive(`/home/${t.id}`) ? s.activeTopic : ""}`}
                                onClick={onClose}
                                title={t.name}
                            >
                                <span className={s.dot} />
                                <span className={s.ellipsis}>{t.name}</span>
                            </Link>
                        </li>
                    ))}
                </ul>

                {/* Bottom actions */}
                <div className={s.bottom}>
                    <Link href="/home/settings" className={s.bottomBtn} onClick={onClose}>
                        <FiSettings />
                        <span>Settings</span>
                    </Link>
                    <button className={s.bottomBtn} onClick={onLogout}>
                        <FiLogOut />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>
        </>
    );
}
