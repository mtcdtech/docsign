import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "Admin") {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const logs = await prisma.auditLog.findMany({
      take: 100,
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ ok: true, logs });
  } catch (e: any) {
    console.error("Failed to fetch audit logs:", e);
    return NextResponse.json(
      { ok: false, error: e.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
