import express from 'express';
import 'dotenv/config';
import pool from './db.js';
import cors from "cors";
import path from 'path';
import http from "http";

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;
const ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

app.use(cors({
    origin: ORIGIN,
    credentials: true,
}))

app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});