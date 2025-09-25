"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiSettings, FiLogOut, FiHome, FiX } from "react-icons/fi";
import { MdOutlineChecklist } from "react-icons/md";
import s from "@/styles/sidebar.module.css";
import { useMe } from "@/hooks/useMe";

const mockTopics = [
    { id: 1, name: "ไปเที่ยวญี่ปุ่น" },
    { id: 2, name: "เรียน React ให้จบ" },
    { id: 3, name: "ออกกำลังกาย 3 ครั้ง/สัปดาห์" },
];

export default function Sidebar({ isOpen = false, isMobile = false, onClose = () => { } }) {
    const pathname = usePathname();
    const { user, loading } = useMe();

    const isActive = (href) => pathname === href || pathname?.startsWith(href + "/");

    const onLogout = async () => {
        if (!confirm("ต้องการออกจากระบบใช่ไหม?")) return;
        try {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
                method: "POST",
                credentials: "include",
            });
        } catch { }
        window.location.href = "/login";
    };

    const avatarSrc =
        user?.profile_image ||
        "no-image.png";

    return (
        <>
            <div
                className={`${s.backdrop} ${isMobile && isOpen ? s.backdropShow : ""}`}
                onClick={onClose}
                aria-hidden="true"
            />
            <aside
                id="sidebar"
                className={`${s.sidebar} ${isMobile && isOpen ? s.open : ""}`}
                inert={isMobile && !isOpen}
                role="navigation"
                aria-label="Sidebar"
            >
                {isMobile && isOpen && (
                    <button className={s.closeBtn} onClick={onClose} aria-label="ปิดเมนู">
                        <FiX />
                    </button>
                )}

                {/* Profile */}
                <div className={s.profile}>
                    <img src={avatarSrc} alt="โปรไฟล์" className={s.avatar} />
                    <div>
                        {loading ? (
                            <>
                                <div className={s.name}>กำลังโหลด…</div>
                            </>
                        ) : user ? (
                            <>
                                <div className={s.name}>{user.username}</div>
                            </>
                        ) : (
                            <>
                                <div className={s.name}>ผู้เยี่ยมชม</div>
                                <div className={s.email}>
                                    <Link href="/login" className={s.link}>เข้าสู่ระบบ</Link>
                                </div>
                            </>
                        )}
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