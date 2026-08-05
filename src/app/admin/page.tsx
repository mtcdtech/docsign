import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { cleanExpiredDrafts } from "@/lib/drafts";
import { redirect } from "next/navigation";
import SubmissionsListClient from "./SubmissionsListClient";
import AuditLogsDashboardClient from "./AuditLogsDashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/");
  }
  const user = session.user as any;
  const isGlobalAdmin = user.role === "Admin";

  // Trigger self-cleaning auto-deletion of expired drafts asynchronously
  cleanExpiredDrafts().catch(console.error);

  // Load timezone setting
  let portalTimezone = "America/Chicago";
  try {
    const tzSetting = await prisma.setting.findFirst({ where: { key: "portal_timezone" } });
    if (tzSetting?.value) portalTimezone = tzSetting.value;
  } catch (e) {}

  let signedDocs = [];
  let auditLogs: any[] = [];
  let stats = { templatesCount: 0, docsCount: 0, draftsCount: 0 };

  if (isGlobalAdmin) {
    signedDocs = await prisma.signedDocument.findMany({
      where: { isDraft: false },
      include: {
        template: {
          include: {
            organization: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    stats.templatesCount = await prisma.template.count();
    stats.docsCount = await prisma.signedDocument.count({ where: { isDraft: false } });
    stats.draftsCount = await prisma.signedDocument.count({ where: { isDraft: true } });
    auditLogs = await prisma.auditLog.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
    });
  } else {
    // Segregate documents by organization memberships
    const orgs = await prisma.organization.findMany({
      where: {
        users: { some: { id: user.id } },
      },
    });
    const orgIds = orgs.map((o) => o.id);

    signedDocs = await prisma.signedDocument.findMany({
      where: {
        isDraft: false,
        template: {
          organizationId: { in: orgIds },
        },
      },
      include: {
        template: {
          include: {
            organization: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    stats.templatesCount = await prisma.template.count({
      where: {
        organizationId: { in: orgIds },
      },
    });
    stats.docsCount = await prisma.signedDocument.count({
      where: { isDraft: false, template: { organizationId: { in: orgIds } } },
    });
    stats.draftsCount = await prisma.signedDocument.count({
      where: { isDraft: true, template: { organizationId: { in: orgIds } } },
    });
  }

  return (
    <div>
      {/* Header and Sync Actions */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "32px",
        }}
      >
        <div>
          <h1>Dashboard Overview</h1>
          <p>Track templates and completed signature form documents.</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="dashboard-grid">
        <div className="card-glass">
          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
            Total Templates
          </span>
          <div style={{ fontSize: "36px", fontWeight: 800, marginTop: "8px" }}>
            {stats.templatesCount}
          </div>
        </div>

        <div className="card-glass">
          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
            Completed Signatures
          </span>
          <div style={{ fontSize: "36px", fontWeight: 800, marginTop: "8px" }}>
            {stats.docsCount}
          </div>
        </div>

        <div className="card-glass">
          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
            Drafts in Progress
          </span>
          <div style={{ fontSize: "36px", fontWeight: 800, marginTop: "8px", color: "#f59e0b" }}>
            {stats.draftsCount}
          </div>
        </div>

        <div className="card-glass">
          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
            Organization Scope
          </span>
          <div style={{ fontSize: "18px", fontWeight: 600, marginTop: "16px", color: "var(--text-main)" }}>
            {isGlobalAdmin ? "Global (All Organizations)" : "Assigned Organizations"}
          </div>
        </div>
      </div>

      {/* Signed Documents Table */}
      <div className="card-glass" style={{ padding: "0px", overflow: "hidden" }}>
        <div style={{ padding: "24px", borderBottom: "1px solid var(--border-color)" }}>
          <h2>Recent Submissions</h2>
          <p style={{ margin: 0, fontSize: "13px" }}>List of signed PDF documents and processing results.</p>
        </div>

        <SubmissionsListClient signedDocs={signedDocs} portalTimezone={portalTimezone} />
      </div>

      {isGlobalAdmin && (
        <div style={{ marginTop: "32px" }}>
          <AuditLogsDashboardClient initialAuditLogs={auditLogs} portalTimezone={portalTimezone} />
        </div>
      )}
    </div>
  );
}

// Node path helper import for basename resolution
import path from "path";
