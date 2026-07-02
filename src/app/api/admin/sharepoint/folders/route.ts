import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getMsGraphToken, listDriveFolders } from "@/lib/sharepoint";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const driveId = searchParams.get("driveId");
    const folderId = searchParams.get("folderId") || "root";

    if (!driveId) {
      return NextResponse.json({ ok: false, error: "Missing driveId parameter" }, { status: 400 });
    }

    const token = await getMsGraphToken();
    const folders = await listDriveFolders(token, driveId, folderId);

    return NextResponse.json({ ok: true, folders });
  } catch (e: any) {
    console.error("SharePoint folders query failed:", e);
    return NextResponse.json({ ok: false, error: e.message || "Failed to fetch folders." }, { status: 500 });
  }
}
