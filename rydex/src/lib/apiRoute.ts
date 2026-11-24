import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import type { AuthRouteContext, ProtectedHandler } from "@/types/auth.types";

export type { AuthRouteContext, ProtectedHandler };

/**
 * A Higher-Order Function to wrap protected API routes.
 * Automatically checks for a valid session and passes the `userId` directly to the handler.
 */
export function withAuth(handler: ProtectedHandler) {
  return async (
    req: NextRequest,
    { params }: { params: Promise<Record<string, string>> }
  ) => {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve params if it's a promise (Next.js 15+ dynamic routes often have promised params)
    const resolvedParams = await params;

    const context: AuthRouteContext = {
      params: resolvedParams,
      userId: session.user.id,
      role: session.user.role as string,
    };

    return handler(req, context);
  };
}
