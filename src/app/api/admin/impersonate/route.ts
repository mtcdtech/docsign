import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Check original role to allow Admin who is currently impersonated as User to stop impersonating
    const originalRole = (session.user as any).originalRole || (session.user as any).role;
    const originalId = (session.user as any).originalId || (session.user as any).id;

    if (originalRole !== "Admin") {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const { userId, action } = await req.json();

    if (action === "stop") {
      await prisma.user.update({
        where: { id: originalId },
        data: { impersonatingId: null },
      });
      return NextResponse.json({ ok: true });
    }

    if (!userId) {
      return NextResponse.json({ ok: false, error: "Missing userId" }, { status: 400 });
    }

    // Impersonate target user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    if (targetUser.id === originalId) {
      return NextResponse.json({ ok: false, error: "Cannot impersonate yourself." }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: originalId },
      data: { impersonatingId: targetUser.id },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Impersonation API error:", e);
    return NextResponse.json({ ok: false, error: e.message || "Internal Server Error" }, { status: 500 });
  }
}
