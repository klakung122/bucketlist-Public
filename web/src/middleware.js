import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const PROTECTED = [/^\/home(\/.*)?$/];

export async function middleware(req) {
    const { nextUrl, cookies } = req;
    const path = nextUrl.pathname;

    const needAuth = PROTECTED.some((re) => re.test(path));
    if (!needAuth) return NextResponse.next();

    const token = cookies.get("token")?.value;
    if (!token) {
        return NextResponse.redirect(new URL("/login", req.url));
    }

    try {
        const secret = new TextEncoder().encode(process.env.JWT_SECRET || "changeme");
        await jwtVerify(token, secret);
        return NextResponse.next();
    } catch {
        return NextResponse.redirect(new URL("/login", req.url));
    }
}

export const config = {
    matcher: ["/home/:path*"],
};