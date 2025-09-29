import express from 'express';
import 'dotenv/config';
import pool from './db.js';
import cors from "cors";
import path from 'path';
import http from "http";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.js";
import topicsRouter from "./routes/topics.js";
import listsRouter from "./routes/lists.js";
import { requireAuth } from "./middlewares/requireAuth.js";

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;
const ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

app.use(cors({
    origin: ORIGIN,
    credentials: true,
}))

app.use(cookieParser());

app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);

app.use("/topics", requireAuth, topicsRouter);

app.use("/lists", requireAuth, listsRouter);

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});