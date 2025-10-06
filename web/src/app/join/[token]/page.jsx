// web/app/join/[token]/page.jsx
"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

export default function JoinPage({ params }) {
    const { token } = params;
    const [state, setState] = useState({ loading: true, ok: false, error: null });

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(
                    `${API_BASE}/invites/${token}/accept`,
                    {
                        method: "POST",
                        credentials: "include",
                    }
                );

                // ถ้ายังไม่ login → redirect ไปหน้า login
                if (res.status === 401) {
                    window.location.href = `/login?next=/join/${token}`;
                    return;
                }

                const json = await res.json();
                if (json.ok) {
                    // ไปหน้า home ของ topic ที่เพิ่งเข้าร่วม
                    window.location.href =
                        "/home/" +
                        (new URLSearchParams(window.location.search).get("next") || "");
                } else {
                    setState({
                        loading: false,
                        ok: false,
                        error: json.error || "JOIN_FAILED",
                    });
                }
            } catch (e) {
                console.error(e);
                setState({ loading: false, ok: false, error: "NETWORK" });
            }
        })();
    }, [token]);

    if (state.loading) return <main style={{ padding: 24 }}>กำลังเข้าร่วม…</main>;
    return (
        <main style={{ padding: 24 }}>
            <h1>เข้าร่วมไม่สำเร็จ</h1>
            <p>{state.error}</p>
        </main>
    );
}