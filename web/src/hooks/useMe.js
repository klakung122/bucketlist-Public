// web/src/hooks/useMe.js
"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

export function useMe() {
    const [user, setUser] = useState(null);   // {id, username, email, profile_image}
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/auth/me`, {
                    credentials: "include",
                });
                if (!mounted) return;
                if (res.ok) {
                    const data = await res.json();
                    setUser(data.user);
                } else {
                    setUser(null);
                }
            } catch {
                setUser(null);
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, []);

    return { user, loading };
}