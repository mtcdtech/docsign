"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

interface Organization {
  id: string;
  name: string;
}

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  department: string | null;
  organizations: Organization[];
}

interface AuditLog {
  id: string;
  email: string;
  action: string;
  createdAt: string | Date;
}

interface SettingsFormProps {
  initialPrimaryColor: string;
  initialPrimaryHover: string;
  initialPortalTitle: string;
  initialLogoBase64: string;
  initialThemeMode: string;
  initialCentralIamUrl: string;
  initialAzureTenantId: string;
  initialAzureClientId: string;
  initialAzureClientSecret: string;
  initialOrganizations: Organization[];
  initialUsers: User[];
  initialAuditLogs: AuditLog[];
  apiKey: string;
  rolesApiUrl: string;
}

export default function SettingsForm({
  initialPrimaryColor,
  initialPrimaryHover,
  initialPortalTitle,
  initialLogoBase64,
  initialThemeMode,
  initialCentralIamUrl,
  initialAzureTenantId,
  initialAzureClientId,
  initialAzureClientSecret,
  initialOrganizations,
  initialUsers,
  initialAuditLogs,
  apiKey,
  rolesApiUrl,
}: SettingsFormProps) {
  const router = useRouter();
  
  // Settings tab selections
  const [activeTab, setActiveTab] = useState("general");

  // Input states
  const [primaryColor, setPrimaryColor] = useState(initialPrimaryColor);
  const [primaryHover, setPrimaryHover] = useState(initialPrimaryHover);
  const [portalTitle, setPortalTitle] = useState(initialPortalTitle);
  const [logoBase64, setLogoBase64] = useState(initialLogoBase64);
  const [themeMode, setThemeMode] = useState(initialThemeMode);
  const [centralIamUrl, setCentralIamUrl] = useState(initialCentralIamUrl);
  const [azureTenantId, setAzureTenantId] = useState(initialAzureTenantId || "");
  const [azureClientId, setAzureClientId] = useState(initialAzureClientId || "");
  const [azureClientSecret, setAzureClientSecret] = useState(initialAzureClientSecret || "");

  // Directory synchronizing states
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ success?: boolean; count?: number; error?: string } | null>(null);

  // General feedback states
  const [dragOver, setDragOver] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const saveSettings = async (fieldsToUpdate: any) => {
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      const payload = {
        primary_color: fieldsToUpdate.primary_color ?? primaryColor,
        primary_hover: fieldsToUpdate.primary_hover ?? primaryHover,
        portal_title: fieldsToUpdate.portal_title ?? portalTitle,
        portal_logo: fieldsToUpdate.portal_logo !== undefined ? fieldsToUpdate.portal_logo : logoBase64,
        theme_mode: fieldsToUpdate.theme_mode ?? themeMode,
        central_iam_url: fieldsToUpdate.central_iam_url ?? centralIamUrl,
        azure_tenant_id: fieldsToUpdate.azure_tenant_id ?? azureTenantId,
        azure_client_id: fieldsToUpdate.azure_client_id ?? azureClientId,
        azure_client_secret: fieldsToUpdate.azure_client_secret ?? azureClientSecret,
      };

      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "Failed to save settings.");
      }

      setSaveSuccess(true);

      // Apply style values in real time on this browser tab
      if (fieldsToUpdate.primary_color) {
        document.documentElement.style.setProperty("--primary-color", fieldsToUpdate.primary_color);
      }
      if (fieldsToUpdate.primary_hover) {
        document.documentElement.style.setProperty("--primary-hover", fieldsToUpdate.primary_hover);
      }
      if (fieldsToUpdate.theme_mode) {
        document.documentElement.setAttribute("data-theme", fieldsToUpdate.theme_mode);
        localStorage.setItem("theme-mode", fieldsToUpdate.theme_mode);
      }

      router.refresh();
    } catch (err: any) {
      setSaveError(err.message || "An error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncDirectory = async () => {
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const res = await fetch("/api/admin/users/sync", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "Sync directory action failed.");
      }
      setSyncStatus({ success: true, count: data.count });
      router.refresh();
    } catch (e: any) {
      setSyncStatus({ success: false, error: e.message || "Failed to synchronize directory." });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const triggerFileInput = () => {
    document.getElementById("logo-file-input")?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setSaveError("Please upload an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setSaveError("File is too large. Please select an image smaller than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      if (uploadEvent.target?.result) {
        const base64Str = uploadEvent.target.result as string;
        setLogoBase64(base64Str);
        saveSettings({ portal_logo: base64Str });
      }
    };
    reader.readAsDataURL(file);
  };

  const clearLogo = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLogoBase64("");
    saveSettings({ portal_logo: "" });
  };

  const tabs = [
    { id: "general", label: "General Configuration" },
    { id: "azure", label: "Azure AD / SharePoint" },
    { id: "branding", label: "Theming & Logo" },
    { id: "central_iam", label: "Central IAM Portal" },
    { id: "users", label: "User Directory" },
    { id: "audit", label: "Login Audit Logs" },
  ];

  return (
    <div>
      {/* Subtab selection headers */}
      <div
        style={{
          display: "flex",
          gap: "6px",
          borderBottom: "1px solid var(--border-color)",
          marginBottom: "28px",
          overflowX: "auto",
          paddingBottom: "1px",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              setSaveSuccess(false);
              setSaveError(null);
              setSyncStatus(null);
            }}
            style={{
              padding: "10px 18px",
              fontSize: "14px",
              fontWeight: activeTab === tab.id ? "600" : "500",
              color: activeTab === tab.id ? "var(--text-main)" : "var(--text-muted)",
              border: "none",
              background: activeTab === tab.id ? "rgba(255, 255, 255, 0.04)" : "transparent",
              borderRadius: "6px 6px 0 0",
              cursor: "pointer",
              transition: "all var(--transition-fast)",
              borderBottom: activeTab === tab.id ? "2px solid var(--primary-color)" : "2px solid transparent",
              whiteSpace: "nowrap",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Settings Body */}
      {activeTab === "general" && (
        <div className="card-glass">
          <h2 style={{ marginBottom: "20px" }}>General Configuration</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveSettings({ portal_title: portalTitle, theme_mode: themeMode });
            }}
            style={{ display: "flex", flexDirection: "column", gap: "20px" }}
          >
            <div className="form-group">
              <label className="form-label">Portal Application Title</label>
              <input
                type="text"
                className="form-input"
                required
                value={portalTitle}
                onChange={(e) => setPortalTitle(e.target.value)}
                placeholder="DocSign Portal"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Default Theme Mode</label>
              <select
                className="form-input"
                value={themeMode}
                onChange={(e) => setThemeMode(e.target.value)}
                style={{
                  background: "rgba(0,0,0,0.2)",
                  cursor: "pointer",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text-main)",
                }}
              >
                <option value="dark" style={{ background: "var(--bg-card)", color: "var(--text-main)" }}>
                  Dark Mode
                </option>
                <option value="light" style={{ background: "var(--bg-card)", color: "var(--text-main)" }}>
                  Light Mode
                </option>
              </select>
            </div>

            {saveSuccess && (
              <div style={{ color: "#22c55e", fontSize: "14px", fontWeight: "bold", background: "rgba(34, 197, 94, 0.1)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(34, 197, 94, 0.2)" }}>
                ✓ General settings saved successfully!
              </div>
            )}

            {saveError && (
              <div style={{ color: "#ef4444", fontSize: "14px", fontWeight: "bold", background: "rgba(239, 68, 68, 0.1)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                ⚠️ {saveError}
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={isSaving} style={{ width: "auto", alignSelf: "flex-end" }}>
              {isSaving ? "Saving Settings..." : "Save General Settings"}
            </button>
          </form>
        </div>
      )}

      {activeTab === "azure" && (
        <div className="card-glass">
          <h2 style={{ marginBottom: "8px" }}>Azure AD / SharePoint Integration</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "24px" }}>
            Configure client credentials for your Azure Active Directory application registration to enable automated SharePoint document uploads.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveSettings({
                azure_tenant_id: azureTenantId,
                azure_client_id: azureClientId,
                azure_client_secret: azureClientSecret
              });
            }}
            style={{ display: "flex", flexDirection: "column", gap: "20px" }}
          >
            <div className="form-group">
              <label className="form-label">Azure Tenant ID *</label>
              <input
                type="text"
                className="form-input"
                required
                value={azureTenantId}
                onChange={(e) => setAzureTenantId(e.target.value)}
                placeholder="e.g. 3a789...-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Azure Client (Application) ID *</label>
              <input
                type="text"
                className="form-input"
                required
                value={azureClientId}
                onChange={(e) => setAzureClientId(e.target.value)}
                placeholder="e.g. 1a234...-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Azure Client Secret *</label>
              <input
                type="password"
                className="form-input"
                required
                value={azureClientSecret}
                onChange={(e) => setAzureClientSecret(e.target.value)}
                placeholder="••••••••••••••••••••••••••••••••"
              />
            </div>

            {saveSuccess && (
              <div style={{ color: "#22c55e", fontSize: "14px", fontWeight: "bold", background: "rgba(34, 197, 94, 0.1)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(34, 197, 94, 0.2)" }}>
                ✓ Azure settings saved successfully!
              </div>
            )}

            {saveError && (
              <div style={{ color: "#ef4444", fontSize: "14px", fontWeight: "bold", background: "rgba(239, 68, 68, 0.1)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                ⚠️ {saveError}
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={isSaving} style={{ width: "auto", alignSelf: "flex-end" }}>
              {isSaving ? "Saving Credentials..." : "Save Azure Credentials"}
            </button>
          </form>
        </div>
      )}

      {activeTab === "branding" && (
        <div className="card-glass">
          <h2 style={{ marginBottom: "20px" }}>Theming & Logo Customization</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveSettings({ primary_color: primaryColor, primary_hover: primaryHover });
            }}
            style={{ display: "flex", flexDirection: "column", gap: "20px" }}
          >
            <div className="form-group">
              <label className="form-label">Portal Brand Logo</label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={triggerFileInput}
                style={{
                  border: `2px dashed ${dragOver ? "var(--primary-color)" : "var(--border-color)"}`,
                  borderRadius: "var(--radius-md)",
                  padding: "28px",
                  textAlign: "center",
                  cursor: "pointer",
                  background: dragOver ? "rgba(79, 70, 229, 0.05)" : "rgba(0, 0, 0, 0.1)",
                  transition: "all var(--transition-fast)",
                }}
              >
                <input
                  type="file"
                  id="logo-file-input"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
                {logoBase64 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                    <img
                      src={logoBase64}
                      alt="Custom Logo Preview"
                      style={{ maxHeight: "64px", maxWidth: "100%", objectFit: "contain", borderRadius: "4px" }}
                    />
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      Custom logo uploaded. Drag & drop or click to replace.
                    </span>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={clearLogo}
                      style={{ padding: "6px 12px", fontSize: "12px", borderRadius: "6px", width: "auto" }}
                    >
                      Remove Logo
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span style={{ fontSize: "14px", fontWeight: "bold" }}>Drag and drop logo here, or click to browse</span>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Supports PNG, JPG, or SVG</span>
                  </div>
                )}
              </div>
            </div>

            <div className="dashboard-grid" style={{ gap: "20px" }}>
              <div className="form-group">
                <label className="form-label">Primary Color Theme (HEX)</label>
                <div style={{ display: "flex", gap: "10px" }}>
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    style={{ width: "46px", height: "46px", border: "1px solid var(--border-color)", borderRadius: "8px", background: "transparent", cursor: "pointer" }}
                  />
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    style={{ flex: 1 }}
                    placeholder="#4f46e5"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Primary Color Hover (HEX)</label>
                <div style={{ display: "flex", gap: "10px" }}>
                  <input
                    type="color"
                    value={primaryHover}
                    onChange={(e) => setPrimaryHover(e.target.value)}
                    style={{ width: "46px", height: "46px", border: "1px solid var(--border-color)", borderRadius: "8px", background: "transparent", cursor: "pointer" }}
                  />
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={primaryHover}
                    onChange={(e) => setPrimaryHover(e.target.value)}
                    style={{ flex: 1 }}
                    placeholder="#4338ca"
                  />
                </div>
              </div>
            </div>

            {saveSuccess && (
              <div style={{ color: "#22c55e", fontSize: "14px", fontWeight: "bold", background: "rgba(34, 197, 94, 0.1)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(34, 197, 94, 0.2)" }}>
                ✓ Theming and logo parameters saved successfully!
              </div>
            )}

            {saveError && (
              <div style={{ color: "#ef4444", fontSize: "14px", fontWeight: "bold", background: "rgba(239, 68, 68, 0.1)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                ⚠️ {saveError}
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={isSaving} style={{ width: "auto", alignSelf: "flex-end" }}>
              {isSaving ? "Saving Branding..." : "Save Theme Preferences"}
            </button>
          </form>
        </div>
      )}

      {activeTab === "central_iam" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
          {/* Central IAM Portal base url settings */}
          <div className="card-glass">
            <h2 style={{ marginBottom: "20px" }}>Central IAM Portal Configuration</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveSettings({ central_iam_url: centralIamUrl });
              }}
              style={{ display: "flex", flexDirection: "column", gap: "20px" }}
            >
              <div className="form-group">
                <label className="form-label">Central IAM Portal Base URL</label>
                <input
                  type="url"
                  className="form-input"
                  required
                  value={centralIamUrl}
                  onChange={(e) => setCentralIamUrl(e.target.value)}
                  placeholder="https://admin.server.mtcd.org"
                />
                <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                  Used to fetch the central user registry directory and associate department access scopes.
                </span>
              </div>

              {saveSuccess && (
                <div style={{ color: "#22c55e", fontSize: "14px", fontWeight: "bold", background: "rgba(34, 197, 94, 0.1)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(34, 197, 94, 0.2)" }}>
                  ✓ Central IAM Portal configuration saved successfully!
                </div>
              )}

              {saveError && (
                <div style={{ color: "#ef4444", fontSize: "14px", fontWeight: "bold", background: "rgba(239, 68, 68, 0.1)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                  ⚠️ {saveError}
                </div>
              )}

              <button type="submit" className="btn btn-primary" disabled={isSaving} style={{ width: "auto", alignSelf: "flex-end" }}>
                {isSaving ? "Saving Configuration..." : "Save Central URL"}
              </button>
            </form>
          </div>

          {/* Central IAM Registry Credentials info */}
          <div className="card-glass">
            <h2 style={{ marginBottom: "12px" }}>Central IAM Registry Integration</h2>
            <p style={{ fontSize: "14px", marginBottom: "20px", color: "var(--text-muted)" }}>
              Use the credentials below to register this DocSign app inside your central IAM Admin stack so roles and user lists synchronize properly.
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
                  value={rolesApiUrl}
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
                  Click to highlight and copy. This matches the Bearer token authentication required in the central IAM registry configurations.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "users" && (
        <div className="card-glass">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            <div>
              <h2>User Management Directory</h2>
              <p style={{ fontSize: "14px", color: "var(--text-muted)", margin: 0 }}>
                View users and departments populated from the Central IAM Portal. This is read-only.
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <a
                href={`${centralIamUrl}/iam/`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
                style={{ width: "auto", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <span>Manage in IAM Portal</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
              <button
                type="button"
                onClick={handleSyncDirectory}
                disabled={isSyncing}
                className="btn btn-primary"
                style={{ width: "auto" }}
              >
                {isSyncing ? "Syncing Directory..." : "Sync Directory"}
              </button>
            </div>
          </div>

          {syncStatus && (
            <div
              style={{
                marginBottom: "20px",
                padding: "12px 16px",
                borderRadius: "6px",
                fontSize: "14px",
                border: syncStatus.success ? "1px solid rgba(34, 197, 94, 0.2)" : "1px solid rgba(239, 68, 68, 0.2)",
                background: syncStatus.success ? "rgba(34, 197, 94, 0.05)" : "rgba(239, 68, 68, 0.05)",
                color: syncStatus.success ? "#22c55e" : "#ef4444",
              }}
            >
              {syncStatus.success
                ? `✓ Directory synchronized successfully! Imported/Updated ${syncStatus.count} user configurations.`
                : `⚠️ Sync failed: ${syncStatus.error}`}
            </div>
          )}

          {/* Users Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
                  <th style={{ padding: "12px 8px" }}>Name</th>
                  <th style={{ padding: "12px 8px" }}>Email</th>
                  <th style={{ padding: "12px 8px" }}>Departments</th>
                  <th style={{ padding: "12px 8px" }}>Assigned Role</th>
                </tr>
              </thead>
              <tbody>
                {initialUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)" }}>
                      No users in directory. Click "Sync Directory" to fetch from central registry.
                    </td>
                  </tr>
                ) : (
                  initialUsers.map((u) => (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
                        transition: "background var(--transition-fast)",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.01)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "12px 8px", fontWeight: "500" }}>{u.name || "—"}</td>
                      <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "var(--text-muted)" }}>
                        {u.email}
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {u.organizations.length === 0 ? (
                            <span style={{ fontSize: "12px", padding: "2px 8px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", color: "var(--text-muted)" }}>
                              General Access
                            </span>
                          ) : (
                            u.organizations.map((org) => (
                              <span
                                key={org.id}
                                style={{
                                  fontSize: "12px",
                                  padding: "2px 8px",
                                  background: "rgba(79, 70, 229, 0.1)",
                                  border: "1px solid rgba(79, 70, 229, 0.2)",
                                  color: "var(--primary-color)",
                                  borderRadius: "4px",
                                }}
                              >
                                {org.name}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        <span
                          style={{
                            fontSize: "12px",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            fontWeight: "600",
                            background:
                              u.role === "Admin"
                                ? "rgba(239, 68, 68, 0.15)"
                                : u.role === "OrgLeader"
                                ? "rgba(234, 179, 8, 0.15)"
                                : "rgba(255, 255, 255, 0.05)",
                            color:
                              u.role === "Admin"
                                ? "#f87171"
                                : u.role === "OrgLeader"
                                ? "#facc15"
                                : "var(--text-main)",
                          }}
                        >
                          {u.role}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "audit" && (
        <div className="card-glass">
          <h2 style={{ marginBottom: "8px" }}>Login Audit History</h2>
          <p style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "20px" }}>
            Tracks in-app sign-in events for SSO and credentials authentication.
          </p>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
                  <th style={{ padding: "12px 8px" }}>User Email</th>
                  <th style={{ padding: "12px 8px" }}>Login Event Type</th>
                  <th style={{ padding: "12px 8px" }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {initialAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)" }}>
                      No sign-in audit logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  initialAuditLogs.map((log) => (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
                        transition: "background var(--transition-fast)",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.01)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "12px 8px", fontFamily: "monospace", fontWeight: "500" }}>
                        {log.email}
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        <span
                          style={{
                            fontSize: "12px",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            fontWeight: "500",
                            background:
                              log.action === "SSO Login" ? "rgba(34, 197, 94, 0.12)" : "rgba(79, 70, 229, 0.12)",
                            color: log.action === "SSO Login" ? "#4ade80" : "#818cf8",
                          }}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: "12px 8px", color: "var(--text-muted)" }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
