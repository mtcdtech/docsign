import { NextResponse } from "next/server";
import { getApiKey } from "@/lib/api-key";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    
    const token = authHeader.substring(7);
    const validToken = getApiKey();
    
    if (token !== validToken) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    
    return NextResponse.json({
      roles: [
        {
          id: "Admin",
          name: "Administrator",
          description: "Full global access to manage all organizations, templates, configurations, and signed documents."
        },
        {
          id: "OrgLeader",
          name: "Organization Leader",
          description: "Can design forms, manage templates, and review signed documents for their assigned organization(s)."
        }
      ]
    });
  } catch (e) {
    console.error("IAM roles API error:", e);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
