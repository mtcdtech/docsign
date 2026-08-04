import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import SessionsListClient from "./SessionsListClient";

export const dynamic = "force-dynamic";

export default async function SessionsListPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/");
  }
  const user = session.user as any;
  const isGlobalAdmin = user.role === "Admin";

  let sessions = [];
  let templates = [];

  if (isGlobalAdmin) {
    sessions = await prisma.signingSession.findMany({
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
    // OrgLeader can only view sessions in their organizations
    const userOrgs = await prisma.organization.findMany({
      where: {
        users: { some: { id: user.id } }
      },
      select: { id: true }
    });
    const orgIds = userOrgs.map(o => o.id);

    sessions = await prisma.signingSession.findMany({
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
  const sessionsMapped = sessions.map((sess) => {
    let tplIds: string[] = [];
    try {
      tplIds = JSON.parse(sess.templateIdsJson) as string[];
    } catch (e) {
      console.warn(`Failed to parse templateIdsJson for session ${sess.id}:`, e);
    }

    const templateTitles = tplIds.map((id) => {
      const t = templates.find((tmp) => tmp.id === id);
      return t ? t.title : "Unknown Template";
    });

    return {
      id: sess.id,
      title: sess.title,
      slug: sess.slug,
      isArchived: sess.isArchived,
      createdAt: sess.createdAt,
      organizationId: sess.organizationId,
      organization: sess.organization,
      templateTitles
    };
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
        <div>
          <h1>Signing Sessions</h1>
          <p>Group multiple templates into sequential packets that users sign in one cohesive flow.</p>
        </div>
        <Link href="/admin/sessions/new" className="btn" style={{ background: "var(--primary-color)", color: "#ffffff", padding: "10px 20px", fontSize: "14px", width: "auto" }}>
          + Create Session
        </Link>
      </div>

      <SessionsListClient initialSessions={sessionsMapped} />
    </div>
  );
}
