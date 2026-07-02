import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "Admin") {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const body = await req.json();
    const { primary_color, primary_hover, portal_title, portal_logo, theme_mode } = body;

    // Validate inputs
    if (!primary_color || !primary_hover || !portal_title) {
      return NextResponse.json({ ok: false, error: "Missing styling parameters." }, { status: 400 });
    }

    // Save style settings to SQLite
    const settings = {
      primary_color,
      primary_hover,
      portal_title,
      portal_logo: portal_logo || "",
      theme_mode: theme_mode || "dark",
    };

    for (const [key, value] of Object.entries(settings)) {
      await prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Failed to save global admin settings:", e);
    return NextResponse.json({ ok: false, error: e.message || "Internal Server Error" }, { status: 500 });
  }
}
