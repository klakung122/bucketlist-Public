// web/lib/socket.js
import { io } from "socket.io-client";

export const socket = io(process.env.NEXT_PUBLIC_API_BASE, {
    path: "/socket.io",
    withCredentials: true,
    autoConnect: false,
    transports: ["websocket"],
});

socket.on("connect_error", (e) => {
    console.warn("socket connect_error:", e?.message);
});