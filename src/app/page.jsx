"use client";
import React from 'react'
import "@/styles/page.css"
import Link from "next/link";

function Page() {
    return (
        <div className="container">
            {/* Navbar */}
            <nav className="navbar">
                <h1 className="logo">Bucketlist</h1>
                <div className="nav-links">
                    <Link href="/register" className="btn primary">
                        ลงทะเบียน
                    </Link>
                    <Link href="/login" className="btn outline">
                        ลงชื่อเข้าใช้
                    </Link>
                </div>
            </nav>

            {/* Hero Section */}
            <main className="hero">
                <h2>แชร์ Bucket List ของคุณกับเพื่อนได้ง่ายๆ</h2>
                <p>
                    คุณสามารถสร้างหัวข้อของตัวเองได้ และยังสามารถเชิญเพื่อนๆ
                    เข้ามาร่วมตั้งเป้าหมายด้วยกัน พร้อมแสดงอัตราความคืบหน้าของแต่ละรายการ
                </p>
                <Link href="/start" className="btn big">
                    เริ่มต้นใช้งาน
                </Link>

                {/* ตัวอย่าง Progress */}
                <div className="progress-demo">
                    <h3>ตัวอย่างความคืบหน้า</h3>
                    <div className="progress">
                        <div className="progress-bar" style={{ width: "60%" }}>
                            60%
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="footer">
                © {new Date().getFullYear()} Bucketlist. All rights reserved.
            </footer>
        </div>
    )
}

export default Page