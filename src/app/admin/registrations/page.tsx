import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import RegistrationsListClient from "./RegistrationsListClient";

export const dynamic = "force-dynamic";

export default async function RegistrationsListPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/");
  }
  const user = session.user as any;
  const isGlobalAdmin = user.role === "Admin";

  let registrations = [];
  let templates = [];

  if (isGlobalAdmin) {
    registrations = await prisma.signingRegistration.findMany({
      include: {
        organization: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    templates = await prisma.template.findMany({
      select: { id: true, title: true }
    });
  } else {
    // OrgLeader can only view registrations in their organizations
    const userOrgs = await prisma.organization.findMany({
      where: {
        users: { some: { id: user.id } }
      },
      select: { id: true }
    });
    const orgIds = userOrgs.map(o => o.id);

    registrations = await prisma.signingRegistration.findMany({
      where: {
        organizationId: { in: orgIds }
      },
      include: {
        organization: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    templates = await prisma.template.findMany({
      where: {
        organizationId: { in: orgIds }
      },
      select: { id: true, title: true }
    });
  }

  // Pre-resolve template titles in ordered sequence
  const registrationsMapped = registrations.map((reg) => {
    let tplIds: string[] = [];
    try {
      tplIds = JSON.parse(reg.templateIdsJson) as string[];
    } catch (e) {
      console.warn(`Failed to parse templateIdsJson for registration ${reg.id}:`, e);
    }

    const templateTitles = tplIds.map((id) => {
      const t = templates.find((tmp) => tmp.id === id);
      return t ? t.title : "Unknown Template";
    });

    return {
      id: reg.id,
      title: reg.title,
      slug: reg.slug,
      isArchived: reg.isArchived,
      createdAt: reg.createdAt,
      organizationId: reg.organizationId,
      organization: reg.organization,
      templateTitles,
      pcoSignupId: reg.pcoSignupId
    };
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
        <div>
          <h1>Signing Registrations</h1>
          <p>Group multiple templates into sequential packets that users sign in one cohesive flow.</p>
        </div>
        <Link href="/admin/registrations/new" className="btn" style={{ background: "var(--primary-color)", color: "#ffffff", padding: "10px 20px", fontSize: "14px", width: "auto" }}>
          + Create Registration
        </Link>
      </div>

      <RegistrationsListClient initialRegistrations={registrationsMapped} />
    </div>
  );
}
