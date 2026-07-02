import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TemplatesListPage() {
  const session = await getServerSession(authOptions);
  const user = session!.user as any;
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
          <h1>Form Templates</h1>
          <p>Create and design PDF signature questionnaires for your organization.</p>
        </div>
        <Link href="/admin/templates/new" className="btn btn-primary" style={{ width: "auto" }}>
          Create New Template
        </Link>
      </div>

      <div className="card-glass" style={{ padding: "0px", overflow: "hidden" }}>
        <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
          {templates.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
              No templates found. Click "Create New Template" to get started.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Template Name</th>
                  <th>Organization</th>
                  <th>Public Slug Link</th>
                  <th>SharePoint Settings</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((tpl) => {
                  const host = process.env.NEXTAUTH_URL || "http://docsign.server.mtcd.org";
                  const publicUrl = `/sign/${tpl.slug}`;
                  const absoluteUrl = `${host}${publicUrl}`;
                  
                  return (
                    <tr key={tpl.id}>
                      <td style={{ fontWeight: 600, color: "var(--text-main)" }}>{tpl.title}</td>
                      <td>{tpl.organization.name}</td>
                      <td>
                        <a href={publicUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary-color)", textDecoration: "none" }}>
                          /{tpl.slug}
                        </a>
                      </td>
                      <td>
                        {tpl.saveSharepoint ? (
                          <span style={{ color: "#22c55e", fontSize: "12px", background: "rgba(34, 197, 94, 0.1)", padding: "4px 8px", borderRadius: "4px" }}>
                            Enabled (Folder: {tpl.sharepointFolderName || "Root"})
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>Disabled</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                          <Link href={`/admin/templates/${tpl.id}/design`} className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "12px", width: "auto" }}>
                            Visual Designer
                          </Link>
                          <Link href={`/admin/templates/${tpl.id}/edit`} className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "12px", width: "auto" }}>
                            Settings
                          </Link>
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
