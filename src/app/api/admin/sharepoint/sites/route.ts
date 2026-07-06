import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getMsGraphToken, listSharepointSites } from "@/lib/sharepoint";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "*";

    const token = await getMsGraphToken();
    const sites = await listSharepointSites(token, search);

    return NextResponse.json({ ok: true, sites });
  } catch (e: any) {
    console.error("SharePoint sites query failed:", e);
    return NextResponse.json({ ok: false, error: e.message || "Failed to search SharePoint sites." }, { status: 500 });
  }
}
