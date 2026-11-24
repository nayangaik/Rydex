import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // 1. Bypass static files and Next.js internal requests
    if (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon.ico") ||
        pathname.includes(".")
    ) {
        return NextResponse.next();
    }

    // 2. Allow public routes
    const isPublicRoute =
        pathname === "/" ||
        pathname.startsWith("/auth") ||
        pathname.startsWith("/api/auth");

    if (isPublicRoute) {
        return NextResponse.next();
    }

    // 3. Get session token (using next-auth/jwt which works in middleware)
    const token = await getToken({
        req,
        secret: process.env.AUTH_SECRET,
    });

    // 4. If not logged in, redirect to login/home
    if (!token) {
        if (pathname.startsWith("/api")) {
            return NextResponse.json(
                { message: "unauthorized" },
                { status: 401 }
            );
        }
        return NextResponse.redirect(new URL("/", req.nextUrl));
    }

    const role = token.role;

    // 5. Admin route protection
    if (pathname.startsWith("/admin")) {
        if (role !== "admin") {
            return NextResponse.redirect(new URL("/", req.nextUrl));
        }
        return NextResponse.next();
    }

    // 6. Partner / vendor route protection (vendor == partner in this app)
    if (pathname.startsWith("/partner") || pathname.startsWith("/vendor")) {
        // Allow onboarding pages for users becoming partners
        if (
            pathname.startsWith("/partner/onboard") ||
            pathname.startsWith("/partner/onboarding")
        ) {
            return NextResponse.next();
        }

        if (role !== "partner" && role !== "vendor") {
            return NextResponse.redirect(new URL("/", req.nextUrl));
        }
        return NextResponse.next();
    }

    // 7. Protected API routes
    if (pathname.startsWith("/api")) {
        if (!token) {
            return NextResponse.json(
                { message: "unauthorized" },
                { status: 401 }
            );
        }
        return NextResponse.next();
    }

    return NextResponse.next();
}


export const config = {
    matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};