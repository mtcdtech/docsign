import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import https from "https";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "Admin") {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // 1. Fetch central portal URL from settings
    const setting = await prisma.setting.findUnique({
      where: { key: "central_iam_url" },
    });
    let centralIamUrl = setting?.value || "https://admin.server.mtcd.org";
    if (centralIamUrl.endsWith("/")) {
      centralIamUrl = centralIamUrl.slice(0, -1);
    }

    // 2. Fetch users from central portal
    const fetchUrl = `${centralIamUrl}/iam/api/export/docsign-users`;
    
    const agent = new https.Agent({ rejectUnauthorized: false });
    const response = await fetch(fetchUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
      // Pass the agent to disable TLS rejection for internal SSL certificates
      ...({ agent } as any),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to fetch from central portal (${response.status}): ${errText}`);
    }

    const externalUsers = await response.json();
    if (!Array.isArray(externalUsers)) {
      throw new Error("Invalid response format from central portal: expected an array.");
    }

    // 3. Process each user and sync departments/roles
    let syncCount = 0;
    for (const extUser of externalUsers) {
      const email = extUser.email?.toLowerCase().trim();
      if (!email) continue;

      const name = extUser.name || extUser.ms_name || extUser.pco_name || "";
      const rawDeptStr = extUser.department || "";
      const role = extUser.role || "User"; // Admin, OrgLeader, User

      // Split departments
      const deptNames = rawDeptStr
        .split("/")
        .map((d: string) => d.trim())
        .filter(Boolean);

      // Create organizations if missing
      const dbOrgs = [];
      for (const orgName of deptNames) {
        const org = await prisma.organization.upsert({
          where: { name: orgName },
          update: {},
          create: { name: orgName },
        });
        dbOrgs.push(org);
      }

      // Upsert user and connect organizations
      await prisma.user.upsert({
        where: { email },
        update: {
          name,
          role,
          department: rawDeptStr || null,
          organizations: {
            set: dbOrgs.map(o => ({ id: o.id })),
          },
        },
        create: {
          email,
          name,
          role,
          department: rawDeptStr || null,
          organizations: {
            connect: dbOrgs.map(o => ({ id: o.id })),
          },
        },
      });

      syncCount++;
    }

    return NextResponse.json({ ok: true, count: syncCount });
  } catch (e: any) {
    console.error("Failed to sync users from central portal:", e);
    return NextResponse.json(
      { ok: false, error: e.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
