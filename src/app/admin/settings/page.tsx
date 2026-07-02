import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getApiKey } from "@/lib/api-key";
import SettingsForm from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/");
  }
  const user = session.user as any;

  // Strict check - settings are restricted to global admin only
  if (user.role !== "Admin") {
    redirect("/admin");
  }

  // Load current settings from database
  const settingsList = await prisma.setting.findMany();
  const settingsMap = settingsList.reduce((acc, curr) => {
    acc[curr.key] = curr.value;
    return acc;
  }, {} as Record<string, string>);

  const primaryColor = settingsMap["primary_color"] || "#4f46e5";
  const primaryHover = settingsMap["primary_hover"] || "#4338ca";
  const portalTitle = settingsMap["portal_title"] || "DocSign Portal";

  // Fetch local API key for central IAM registration
  const apiKey = getApiKey();

  return (
    <div>
      <div style={{ marginBottom: "32px" }}>
        <h1>Global Admin Settings</h1>
        <p>Manage in-app branding styles, custom parameters, and security tokens.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
        {/* Branding Styling Form */}
        <SettingsForm
          initialPrimaryColor={primaryColor}
          initialPrimaryHover={primaryHover}
          initialPortalTitle={portalTitle}
        />

        {/* Central IAM API Registry Info */}
        <div className="card-glass">
          <h2 style={{ marginBottom: "12px" }}>Central IAM Registry Integration</h2>
          <p style={{ fontSize: "14px", marginBottom: "20px" }}>
            Use the credentials below to register this DocSign app inside your central central IAM Admin stack, so roles and user lists synchronize properly.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">DocSign Client App Slug</label>
              <input
                type="text"
                readOnly
                className="form-input"
                value="docsign"
                style={{ fontFamily: "monospace", background: "rgba(0,0,0,0.4)", cursor: "text" }}
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Exposed User-Roles API URL</label>
              <input
                type="text"
                readOnly
                className="form-input"
                value={`${process.env.NEXTAUTH_URL || "http://docsign.server.mtcd.org"}/api/iam/roles`}
                style={{ fontFamily: "monospace", background: "rgba(0,0,0,0.4)", cursor: "text" }}
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Synchronization API Token (Bearer)</label>
              <input
                type="text"
                readOnly
                className="form-input"
                value={apiKey}
                style={{ fontFamily: "monospace", background: "rgba(0,0,0,0.4)", cursor: "text", fontSize: "13px" }}
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                Click to highlight and copy. This matches theBearer token authentication required in the central IAM registry configurations.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
