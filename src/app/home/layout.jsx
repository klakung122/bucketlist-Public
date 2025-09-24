"use client";

import { useRef, useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import s from "@/styles/home-shell.module.css";
import { FiMenu } from "react-icons/fi";

export default function HomeShell({ children }) {
    const [open, setOpen] = useState(false);       // ใช้เฉพาะ mobile
    const [isMobile, setIsMobile] = useState(false);
    const menuBtnRef = useRef(null);

    useEffect(() => {
        const onResize = () => {
            const mobile = window.matchMedia("(max-width: 768px)").matches;
            setIsMobile(mobile);
            if (!mobile) setOpen(false);               // เดสก์ท็อปไม่ใช้ overlay
        };
        onResize();                                  // run once on mount
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    useEffect(() => {
        // ล็อกสกรอลเฉพาะมือถือเวลามี overlay
        const mobile = window.matchMedia("(max-width: 768px)").matches;
        if (mobile) document.documentElement.style.overflow = open ? "hidden" : "";
        return () => { document.documentElement.style.overflow = ""; };
    }, [open]);

    const closeSidebar = () => {
        setOpen(false);
        requestAnimationFrame(() => menuBtnRef.current?.focus());
    };

    return (
        <div className={s.shell}>
            {/* ปุ่มนี้แสดงเฉพาะมือถือ */}
            <header className={s.mobileHeader}>
                <button
                    ref={menuBtnRef}
                    className={s.menuBtn}
                    onClick={() => setOpen(true)}
                    aria-label="เปิดเมนู"
                    aria-controls="sidebar"
                    aria-expanded={open}
                >
                    <FiMenu />
                </button>
            </header>

            {/* เดสก์ท็อป: isOpen จะถูกมองว่า true เสมอ (ไม่ overlay)
         มือถือ: ใช้ open ปกติ */}
            <Sidebar
                isOpen={isMobile ? open : true}
                isMobile={isMobile}
                onClose={closeSidebar}
                menuBtnRef={menuBtnRef}
            />

            <main className={s.content}>{children}</main>
        </div>
    );
}