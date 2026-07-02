import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getMsGraphToken, listSiteDrives } from "@/lib/sharepoint";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get("siteId");

    if (!siteId) {
      return NextResponse.json({ ok: false, error: "Missing siteId parameter" }, { status: 400 });
    }

    const token = await getMsGraphToken();
    const drives = await listSiteDrives(token, siteId);

    return NextResponse.json({ ok: true, drives });
  } catch (e: any) {
    console.error("SharePoint drives query failed:", e);
    return NextResponse.json({ ok: false, error: e.message || "Failed to fetch document libraries." }, { status: 500 });
  }
}
