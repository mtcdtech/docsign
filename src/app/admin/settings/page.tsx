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
    const portalLogoLight = settingsMap["portal_logo_light"] || "";
    const portalLogoDark = settingsMap["portal_logo_dark"] || "";
    const masterLogoLight = settingsMap["master_logo_light"] || "";
    const masterLogoDark = settingsMap["master_logo_dark"] || "";
    const themeMode = settingsMap["theme_mode"] || "dark";
    const portalTimezone = settingsMap["portal_timezone"] || "America/Chicago";
    const centralIamUrl = settingsMap["central_iam_url"] || "https://admin.server.mtcd.org";
    const azureTenantId = settingsMap["azure_tenant_id"] || process.env.AZURE_AD_TENANT_ID || "";
    const azureClientId = settingsMap["azure_client_id"] || process.env.AZURE_AD_CLIENT_ID || "";
    const azureClientSecret = settingsMap["azure_client_secret"] || process.env.AZURE_AD_CLIENT_SECRET || "";

    const pcoApplicationId = settingsMap["pco_application_id"] || process.env.PCO_APPLICATION_ID || "";
    const pcoSecret = settingsMap["pco_secret"] || process.env.PCO_SECRET || "";

    // Default SMTP settings using DB settings with process.env / Azure AD auto-config fallbacks
    let smtpHost = settingsMap["smtp_host"] || process.env.SMTP_HOST || "";
    let smtpPort = settingsMap["smtp_port"] || process.env.SMTP_PORT || "587";
    let smtpUser = settingsMap["smtp_user"] || process.env.SMTP_USER || "";
    let smtpPass = settingsMap["smtp_pass"] || process.env.SMTP_PASS || "";
    let smtpFrom = settingsMap["smtp_from"] || process.env.SMTP_FROM || "docsign@mtcd.org";

    if (!smtpHost && azureClientId && azureTenantId && azureClientSecret) {
      smtpHost = "smtp.azurecomm.net";
      smtpPort = "587";
      if (!smtpUser) smtpUser = `${azureClientId}@${azureTenantId}`;
      if (!smtpPass) smtpPass = azureClientSecret;
    }

    if (!smtpHost) smtpHost = "smtp.azurecomm.net";

    const reminderDelayHours = settingsMap["reminder_delay_hours"] || "24";

    // Fetch local API key for central IAM registration
    const apiKey = getApiKey();
    const rolesApiUrl = `${process.env.NEXTAUTH_URL || "http://docsign.server.mtcd.org"}/api/iam/roles`;

    // Fetch database entries for Directory, Organizations, and Audit Logs
    const organizations = await prisma.organization.findMany({
      orderBy: { name: "asc" }
    });

    const users = await prisma.user.findMany({
      include: { organizations: true },
      orderBy: { email: "asc" }
    });

    const auditLogs = await prisma.auditLog.findMany({
      take: 100,
      orderBy: { createdAt: "desc" }
    });

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
            initialLogoLightBase64={portalLogoLight}
            initialLogoDarkBase64={portalLogoDark}
            initialMasterLogoLightBase64={masterLogoLight}
            initialMasterLogoDarkBase64={masterLogoDark}
            initialThemeMode={themeMode}
            initialCentralIamUrl={centralIamUrl}
            initialAzureTenantId={azureTenantId}
            initialAzureClientId={azureClientId}
            initialAzureClientSecret={azureClientSecret}
            initialPcoApplicationId={pcoApplicationId}
            initialPcoSecret={pcoSecret}
            initialPortalTimezone={portalTimezone}
            initialSmtpHost={smtpHost}
            initialSmtpPort={smtpPort}
            initialSmtpUser={smtpUser}
            initialSmtpPass={smtpPass}
            initialSmtpFrom={smtpFrom}
            initialReminderDelayHours={reminderDelayHours}
            initialOrganizations={organizations}
            initialUsers={users}
            initialAuditLogs={auditLogs}
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
