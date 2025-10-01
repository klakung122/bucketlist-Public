// api/socket.js
import { Server } from "socket.io";
import cookie from "cookie";
import jwt from "jsonwebtoken";

let io = null;

export function initSocket(httpServer, { origin, jwtSecret = "changeme" }) {
    io = new Server(httpServer, {
        cors: { origin, credentials: true },
        path: "/socket.io",
    });

    // ตรวจ JWT จาก cookie ตอน handshake
    io.use((socket, next) => {
        try {
            const raw = socket.handshake.headers.cookie || "";
            const cookies = cookie.parse(raw);
            const token = cookies?.token;
            if (!token) return next(new Error("UNAUTHORIZED"));
            const payload = jwt.verify(token, jwtSecret);
            socket.user = { id: payload.id, username: payload.username };
            return next();
        } catch (e) {
            return next(new Error("UNAUTHORIZED"));
        }
    });

    io.on("connection", (socket) => {
        // เข้าห้องส่วนตัวของผู้ใช้ (ไว้ยิงอีเวนต์ที่เกี่ยวกับ "รายการหัวข้อของฉัน")
        socket.join(userRoom(socket.user.id));

        // ถ้าจะใช้ room ของ topic ตอนเปิดหน้า topic ค่อย emit join/leave ฝั่ง client
        socket.on("join:topic", (slug) => slug && socket.join(topicRoom(slug)));
        socket.on("leave:topic", (slug) => slug && socket.leave(topicRoom(slug)));
    });

    return io;
}

export function getIo() {
    if (!io) throw new Error("Socket.io not initialized");
    return io;
}

export function userRoom(userId) {
    return `user:${userId}`;
}

export function topicRoom(slug) {
    return `topic:${slug}`;
}