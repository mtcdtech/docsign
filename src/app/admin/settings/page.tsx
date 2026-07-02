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

  try {
    // Load current settings from database
    const settingsList = await prisma.setting.findMany();
    const settingsMap = settingsList.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    const primaryColor = settingsMap["primary_color"] || "#4f46e5";
    const primaryHover = settingsMap["primary_hover"] || "#4338ca";
    const portalTitle = settingsMap["portal_title"] || "DocSign Portal";
    const portalLogo = settingsMap["portal_logo"] || "";
    const themeMode = settingsMap["theme_mode"] || "dark";

    // Fetch local API key for central IAM registration
    const apiKey = getApiKey();
    const rolesApiUrl = `${process.env.NEXTAUTH_URL || "http://docsign.server.mtcd.org"}/api/iam/roles`;

    return (
      <div>
        <div style={{ marginBottom: "32px" }}>
          <h1>Global Admin Settings</h1>
          <p>Manage in-app branding styles, custom parameters, and security tokens.</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          {/* Branding Styling Form & Central IAM API Info (Client-Side Component) */}
          <SettingsForm
            initialPrimaryColor={primaryColor}
            initialPrimaryHover={primaryHover}
            initialPortalTitle={portalTitle}
            initialLogoBase64={portalLogo}
            initialThemeMode={themeMode}
            apiKey={apiKey}
            rolesApiUrl={rolesApiUrl}
          />
        </div>
      </div>
    );
  } catch (err: any) {
    return (
      <div className="card-glass" style={{ maxWidth: "800px", margin: "40px auto", padding: "32px" }}>
        <h2 style={{ color: "#ef4444", marginBottom: "16px" }}>Settings Page Load Error</h2>
        <p style={{ marginBottom: "20px" }}>
          The settings page failed to load due to a server-side exception. Please see the technical details below:
        </p>
        <pre style={{
          background: "rgba(0, 0, 0, 0.6)",
          padding: "20px",
          borderRadius: "8px",
          border: "1px solid rgba(239, 68, 68, 0.2)",
          color: "#f87171",
          overflowX: "auto",
          fontFamily: "monospace",
          fontSize: "13px",
          whiteSpace: "pre-wrap"
        }}>
          {err.stack || err.message || String(err)}
        </pre>
        <div style={{ marginTop: "24px" }}>
          <a href="/admin" className="btn btn-primary" style={{ width: "auto" }}>
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  }
}
