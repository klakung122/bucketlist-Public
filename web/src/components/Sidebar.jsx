"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiSettings, FiLogOut, FiHome, FiX } from "react-icons/fi";
import { MdOutlineChecklist } from "react-icons/md";
import s from "@/styles/sidebar.module.css";
import { useMe } from "@/hooks/useMe";
import { useEffect, useState, useCallback } from "react";
import { API_BASE } from "@/lib/api";
import { absolutize } from "@/utils/url";
import { socket } from "@/lib/socket";

const buildPravatar = (user) => {
    if (!user) return null;
    const seed = user.id || user.email || user.username || "guest";
    return `https://i.pravatar.cc/80?u=${encodeURIComponent(seed)}`;
};

export default function Sidebar({ isOpen = false, isMobile = false, onClose = () => { } }) {
    const pathname = usePathname();
    const { user, loading: userLoading } = useMe();

    const [topics, setTopics] = useState([]);
    const [topicsLoading, setTopicsLoading] = useState(false);

    const isActive = (href) => pathname === href || pathname?.startsWith(href + "/");

    // โหลดหัวข้อจริง
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                setTopicsLoading(true);
                const res = await fetch(`${API_BASE}/topics`, { credentials: "include" });
                const json = await res.json();
                if (!alive) return;
                if (json?.ok && Array.isArray(json.data)) {
                    setTopics(json.data); // [{id, title, slug, ...}]
                } else {
                    setTopics([]);
                }
            } catch (e) {
                console.error("Load topics failed:", e);
                setTopics([]);
            } finally {
                if (alive) setTopicsLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, []);

    // ⬇️ เปิด socket และฟังอีเวนต์สำหรับรายการหัวข้อของฉัน
    useEffect(() => {
        if (!socket.connected) socket.connect();

        const onCreated = ({ topic }) => {
            setTopics((prev) => [topic, ...prev]);
        };

        const onUpdated = ({ topic }) => {
            setTopics((prev) => prev.map(t => (t.id === topic.id ? { ...t, ...topic } : t)));
        };

        const onDeleted = ({ id }) => {
            setTopics((prev) => prev.filter(t => t.id !== id));
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

    const onLogout = useCallback(async () => {
        if (!confirm("ต้องการออกจากระบบใช่ไหม?")) return;
        try {
            await fetch(`${API_BASE}/auth/logout`, {
                method: "POST",
                credentials: "include",
            });
        } catch { }
        window.location.href = "/login";
    }, []);

    const pravatar = buildPravatar(user);

    const avatarSrc = userLoading
        ? "/no-image.png"
        : (user?.profile_image?.trim()
            ? absolutize(user.profile_image.trim())
            : (pravatar || "/no-image.png"));

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
                aria-hidden={isMobile && !isOpen}
                {...(isMobile && !isOpen ? { inert: true } : {})}
                role="navigation"
                aria-label="Sidebar"
            >
                {isMobile && isOpen && (
                    <button className={s.closeBtn} onClick={onClose} aria-label="ปิดเมนู" type="button">
                        <FiX />
                    </button>
                )}

                {/* Profile */}
                <div className={s.profile}>
                    <img src={avatarSrc} alt="โปรไฟล์" className={s.avatar} loading="lazy" />
                    <div>
                        {userLoading ? (
                            <div className={s.name}>กำลังโหลด…</div>
                        ) : user ? (
                            <div className={s.name}>{user.username}</div>
                        ) : (
                            <>
                                <div className={s.name}>ผู้เยี่ยมชม</div>
                                <div className={s.email}>
                                    <Link href="/login" className={s.link}>
                                        เข้าสู่ระบบ
                                    </Link>
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
                    {topicsLoading && (
                        <>
                            <li className={s.topicSkeleton} />
                            <li className={s.topicSkeleton} />
                            <li className={s.topicSkeleton} />
                        </>
                    )}

                    {!topicsLoading && topics.length === 0 && (
                        <li className={s.topicEmpty}>ยังไม่มีหัวข้อ</li>
                    )}

                    {!topicsLoading &&
                        topics.map((t) => {
                            // รองรับกรณีไม่มี slug (fallback เป็น id)
                            const slug = t.slug || t.id;
                            const title = t.title || t.name || "Untitled";
                            const href = `/home/${slug}`;
                            return (
                                <li key={t.id}>
                                    <Link
                                        href={href}
                                        className={`${s.topicItem} ${isActive(href) ? s.activeTopic : ""}`}
                                        onClick={onClose}
                                        title={title}
                                    >
                                        <span className={s.dot} />
                                        <span className={s.ellipsis}>{title}</span>
                                    </Link>
                                </li>
                            );
                        })}
                </ul>

                {/* Bottom actions */}
                <div className={s.bottom}>
                    <Link href="/home/settings" className={s.bottomBtn} onClick={onClose}>
                        <FiSettings />
                        <span>Settings</span>
                    </Link>
                    <button className={s.bottomBtn} onClick={onLogout} type="button">
                        <FiLogOut />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>
        </>
    );
}