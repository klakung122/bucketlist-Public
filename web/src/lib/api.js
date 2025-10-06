// src/lib/api.js
export const API_BASE = (() => {
    const raw = (process.env.NEXT_PUBLIC_API_BASE ?? "").trim();
    if (!raw) return "/api"; // ไม่ตั้ง env → ใช้ /api

    const noTrail = raw.replace(/\/+$/, ""); // ตัด / ท้าย
    // ถ้า env ลงท้ายด้วย /api อยู่แล้ว ก็ใช้เลย ไม่ต้องเติมซ้ำ
    return /(?:^|\/)api$/.test(noTrail) ? noTrail : `${noTrail}/api`;
})();