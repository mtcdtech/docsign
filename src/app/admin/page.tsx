import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SyncIamButton from "./SyncIamButton";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/");
  }
  const user = session.user as any;
  const isGlobalAdmin = user.role === "Admin";

  let signedDocs = [];
  let stats = { templatesCount: 0, docsCount: 0 };

  if (isGlobalAdmin) {
    signedDocs = await prisma.signedDocument.findMany({
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
    stats.docsCount = await prisma.signedDocument.count();
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
    stats.docsCount = signedDocs.length;
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
        {isGlobalAdmin && <SyncIamButton />}
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

        <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
          {signedDocs.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
              No completed signatures found yet.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Signer Name</th>
                  <th>Template</th>
                  <th>Organization</th>
                  <th>Date Signed</th>
                  <th>Integrations</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {signedDocs.map((doc) => {
                  const cleanFilename = path.basename(doc.signedPdfPath);
                  const downloadUrl = `/uploads/signed/${cleanFilename}`;
                  
                  return (
                    <tr key={doc.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{doc.signerName}</div>
                        <div style={{ fontSize: "12px" }}>{doc.signerEmail}</div>
                      </td>
                      <td>{doc.template.title}</td>
                      <td>{doc.template.organization.name}</td>
                      <td>{new Date(doc.createdAt).toLocaleString()}</td>
                      <td>
                        <div style={{ display: "flex", gap: "8px", fontSize: "11px" }}>
                          <span style={{ color: doc.emailedUser ? "#22c55e" : "#ef4444" }}>
                            {doc.emailedUser ? "✓ User Email" : "✗ User Email"}
                          </span>
                          <span style={{ color: doc.emailedLeader ? "#22c55e" : "#ef4444" }}>
                            {doc.emailedLeader ? "✓ Leader Email" : "✗ Leader Email"}
                          </span>
                          {doc.template.saveSharepoint && (
                            <span style={{ color: doc.sharepointUrl ? "#22c55e" : "#ef4444" }}>
                              {doc.sharepointUrl ? "✓ SharePoint" : "✗ SharePoint"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                          {doc.sharepointUrl && (
                            <a
                              href={doc.sharepointUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-secondary"
                              style={{ padding: "6px 12px", fontSize: "12px", width: "auto" }}
                            >
                              SharePoint
                            </a>
                          )}
                          <a
                            href={downloadUrl}
                            download
                            className="btn btn-primary"
                            style={{ padding: "6px 12px", fontSize: "12px", width: "auto" }}
                          >
                            Download PDF
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// Node path helper import for basename resolution
import path from "path";
