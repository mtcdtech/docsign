import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";

import TemplatesListClient from "./TemplatesListClient";

export const dynamic = "force-dynamic";

export default async function TemplatesListPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/");
  }
  const user = session.user as any;
  const isGlobalAdmin = user.role === "Admin";

  let templates = [];
  
  if (isGlobalAdmin) {
    templates = await prisma.template.findMany({
      include: { organization: true },
      orderBy: { createdAt: "desc" }
    });
  } else {
    // Segregate templates by organization memberships
    const orgs = await prisma.organization.findMany({
      where: {
        users: { some: { id: user.id } }
      }
    });
    const orgIds = orgs.map(o => o.id);

    templates = await prisma.template.findMany({
      where: {
        organizationId: { in: orgIds }
      },
      include: { organization: true },
      orderBy: { createdAt: "desc" }
    });
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
        <div>
          <h1>Form TemplatesLog</h1>
          <p>Create, sort, and inspect submissions history logs for your church waivers.</p>
        </div>
      </div>

      <TemplatesListClient templates={templates} />
    </div>
  );
}
