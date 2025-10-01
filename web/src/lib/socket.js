// web/lib/socket.js
import { io } from "socket.io-client";
import { API_BASE } from "@/lib/api";

export const socket = io(API_BASE, {
    path: "/socket.io",
    withCredentials: true,
    autoConnect: false,
    transports: ["websocket"],
});

socket.on("connect_error", (e) => {
    console.warn("socket connect_error:", e?.message);
});