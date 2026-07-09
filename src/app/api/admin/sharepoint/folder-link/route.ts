import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getMsGraphToken, getDriveItemDetails } from "@/lib/sharepoint";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const folderIdParam = searchParams.get("folderId");

    if (!folderIdParam) {
      return NextResponse.json({ ok: false, error: "Missing folderId parameter" }, { status: 400 });
    }

    // Split driveId and folderId from folderIdParam
    const parts = folderIdParam.split("/");
    const driveId = parts[0];
    const folderId = parts.slice(1).join("/");

    if (!driveId || !folderId) {
      return NextResponse.json({ ok: false, error: "Invalid folderId format" }, { status: 400 });
    }

    const token = await getMsGraphToken();
    const folderDetails = await getDriveItemDetails(token, driveId, folderId);

    return NextResponse.json({ ok: true, webUrl: folderDetails.webUrl });
  } catch (e: any) {
    console.error("SharePoint folder link lookup failed:", e);
    return NextResponse.json({ ok: false, error: e.message || "Failed to look up folder." }, { status: 500 });
  }
}
