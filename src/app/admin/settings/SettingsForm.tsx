"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

interface Organization {
  id: string;
  name: string;
  logoLight?: string | null;
  logoDark?: string | null;
}

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  roleOverride?: boolean;
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
  initialLogoLightBase64: string;
  initialLogoDarkBase64: string;
  initialThemeMode: string;
  initialCentralIamUrl: string;
  initialAzureTenantId: string;
  initialAzureClientId: string;
  initialAzureClientSecret: string;
  initialPcoApplicationId: string;
  initialPcoSecret: string;
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
  initialLogoLightBase64,
  initialLogoDarkBase64,
  initialThemeMode,
  initialCentralIamUrl,
  initialAzureTenantId,
  initialAzureClientId,
  initialAzureClientSecret,
  initialPcoApplicationId,
  initialPcoSecret,
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
  const [logoLight, setLogoLight] = useState(initialLogoLightBase64);
  const [logoDark, setLogoDark] = useState(initialLogoDarkBase64);
  const [orgs, setOrgs] = useState<Organization[]>(initialOrganizations);
  const [themeMode, setThemeMode] = useState(initialThemeMode);
  const [centralIamUrl, setCentralIamUrl] = useState(initialCentralIamUrl);
  const [azureTenantId, setAzureTenantId] = useState(initialAzureTenantId || "");
  const [azureClientId, setAzureClientId] = useState(initialAzureClientId || "");
  const [azureClientSecret, setAzureClientSecret] = useState(initialAzureClientSecret || "");
  const [pcoApplicationId, setPcoApplicationId] = useState(initialPcoApplicationId || "");
  const [pcoSecret, setPcoSecret] = useState(initialPcoSecret || "");

  // Directory synchronizing states
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingIam, setIsSyncingIam] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ success?: boolean; count?: number; error?: string; details?: string } | null>(null);

  // General feedback states
  const [dragOver, setDragOver] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // User directory sorting states
  const [userSortBy, setUserSortBy] = useState<"name" | "email" | "role">("name");
  const [userSortOrder, setUserSortOrder] = useState<"asc" | "desc">("asc");

  // User directory navigation and collapse states
  const [collapsedDepts, setCollapsedDepts] = useState<Record<string, boolean>>({});
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Local state for interactive users list
  const [usersList, setUsersList] = useState<User[]>(initialUsers);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  React.useEffect(() => {
    setUsersList(initialUsers);
  }, [initialUsers]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingUserId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole, roleOverride: true })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setUsersList(prev => prev.map(u => u.id === userId ? { ...u, role: newRole, roleOverride: true } : u));
        router.refresh();
      } else {
        alert(`Failed to update user role: ${data.error || "Unknown error"}`);
      }
    } catch (e: any) {
      console.error("Failed to update user role manually:", e);
      alert("Error updating user role.");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleResetOverride = async (userId: string) => {
    setUpdatingUserId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleOverride: false })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setUsersList(prev => prev.map(u => u.id === userId ? { ...u, roleOverride: false } : u));
        router.refresh();
      } else {
        alert(`Failed to clear manual override: ${data.error || "Unknown error"}`);
      }
    } catch (e: any) {
      console.error("Failed to reset manual override:", e);
      alert("Error resetting manual override.");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const triggerDeleteConfirm = (userId: string) => {
    setDeleteConfirmId(userId);
    // Reset after 5 seconds if not confirmed
    setTimeout(() => {
      setDeleteConfirmId(prev => prev === userId ? null : prev);
    }, 5000);
  };

  const handleImpersonate = async (userId: string) => {
    setUpdatingUserId(userId);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        window.location.reload();
      } else {
        alert(`Failed to impersonate user: ${data.error || "Unknown error"}`);
      }
    } catch (e: any) {
      console.error(e);
      alert("Error starting impersonation.");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setUpdatingUserId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setUsersList(prev => prev.filter(u => u.id !== userId));
        router.refresh();
      } else {
        alert(`Failed to delete user: ${data.error || "Unknown error"}`);
      }
    } catch (e: any) {
      console.error(e);
      alert("Error deleting user.");
    } finally {
      setUpdatingUserId(null);
      setDeleteConfirmId(null);
    }
  };

  const handleUserSort = (field: "name" | "email" | "role") => {
    if (userSortBy === field) {
      setUserSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setUserSortBy(field);
      setUserSortOrder("asc");
    }
  };

  const getSortedUsers = (userList: User[]) => {
    return [...userList].sort((a, b) => {
      let valA = "";
      let valB = "";
      if (userSortBy === "name") {
        valA = (a.name || "").toLowerCase();
        valB = (b.name || "").toLowerCase();
      } else if (userSortBy === "email") {
        valA = a.email.toLowerCase();
        valB = b.email.toLowerCase();
      } else if (userSortBy === "role") {
        valA = a.role.toLowerCase();
        valB = b.role.toLowerCase();
      }
      return userSortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
  };

  const saveSettings = async (fieldsToUpdate: any) => {
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      const payload = {
        primary_color: fieldsToUpdate.primary_color ?? primaryColor,
        primary_hover: fieldsToUpdate.primary_hover ?? primaryHover,
        portal_title: fieldsToUpdate.portal_title ?? portalTitle,
        portal_logo_light: fieldsToUpdate.portal_logo_light !== undefined ? fieldsToUpdate.portal_logo_light : logoLight,
        portal_logo_dark: fieldsToUpdate.portal_logo_dark !== undefined ? fieldsToUpdate.portal_logo_dark : logoDark,
        theme_mode: fieldsToUpdate.theme_mode ?? themeMode,
        central_iam_url: fieldsToUpdate.central_iam_url ?? centralIamUrl,
        azure_tenant_id: fieldsToUpdate.azure_tenant_id ?? azureTenantId,
        azure_client_id: fieldsToUpdate.azure_client_id ?? azureClientId,
        azure_client_secret: fieldsToUpdate.azure_client_secret ?? azureClientSecret,
        pco_application_id: fieldsToUpdate.pco_application_id ?? pcoApplicationId,
        pco_secret: fieldsToUpdate.pco_secret ?? pcoSecret,
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

  const handleSyncIamRegistry = async () => {
    setIsSyncingIam(true);
    setSyncStatus(null);
    try {
      const res = await fetch("/api/admin/sync-iam", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "Sync IAM Registry failed.");
      }
      setSyncStatus({ 
        success: true, 
        count: (data.added || 0) + (data.updated || 0), 
        details: `Imported: Added ${data.added || 0}, Updated ${data.updated || 0}, Deleted ${data.deleted || 0} user records.`
      });
      router.refresh();
    } catch (e: any) {
      setSyncStatus({ success: false, error: e.message || "Failed to synchronize directory from central IAM." });
    } finally {
      setIsSyncingIam(false);
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

  const handleLogoUpload = (type: "light" | "dark", file: File) => {
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
        if (type === "light") {
          setLogoLight(base64Str);
          saveSettings({ portal_logo_light: base64Str });
        } else {
          setLogoDark(base64Str);
          saveSettings({ portal_logo_dark: base64Str });
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const clearLogo = (type: "light" | "dark", e: React.MouseEvent) => {
    e.stopPropagation();
    if (type === "light") {
      setLogoLight("");
      saveSettings({ portal_logo_light: "" });
    } else {
      setLogoDark("");
      saveSettings({ portal_logo_dark: "" });
    }
  };

  const handleOrgLogoUpload = async (orgId: string, type: "light" | "dark", file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("File is too large (max 2MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      if (e.target?.result) {
        const base64Str = e.target.result as string;
        try {
          const res = await fetch(`/api/admin/organizations/${orgId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              type === "light" ? { logoLight: base64Str } : { logoDark: base64Str }
            )
          });
          const data = await res.json();
          if (!res.ok || data.ok === false) {
            throw new Error(data.error || "Failed to upload logo.");
          }
          setOrgs((prev) =>
            prev.map((o) =>
              o.id === orgId
                ? {
                    ...o,
                    logoLight: type === "light" ? base64Str : o.logoLight,
                    logoDark: type === "dark" ? base64Str : o.logoDark
                  }
                : o
            )
          );
        } catch (err: any) {
          alert(err.message || "Failed to upload logo.");
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleOrgLogoClear = async (orgId: string, type: "light" | "dark") => {
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          type === "light" ? { logoLight: null } : { logoDark: null }
        )
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "Failed to remove logo.");
      }
      setOrgs((prev) =>
        prev.map((o) =>
          o.id === orgId
            ? {
                ...o,
                logoLight: type === "light" ? null : o.logoLight,
                logoDark: type === "dark" ? null : o.logoDark
              }
            : o
        )
      );
    } catch (err: any) {
      alert(err.message || "Failed to remove logo.");
    }
  };

  const tabs = [
    { id: "general", label: "General Configuration" },
    { id: "azure", label: "Azure AD / SharePoint" },
    { id: "pco", label: "Planning Center (PCO)" },
    { id: "branding", label: "Theming & Logo" },
    { id: "organizations", label: "Organization Branding" },
    { id: "central_iam", label: "Central IAM Portal" },
    { id: "users", label: "User Directory" },
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

      {activeTab === "pco" && (
        <div className="card-glass">
          <h2 style={{ marginBottom: "8px" }}>Planning Center Online (PCO) Integration</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "24px" }}>
            Configure your Planning Center Application ID and Secret (PAT) to enable live registration syncing and status updates.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveSettings({
                pco_application_id: pcoApplicationId,
                pco_secret: pcoSecret
              });
            }}
            style={{ display: "flex", flexDirection: "column", gap: "20px" }}
          >
            <div className="form-group">
              <label className="form-label">PCO Application ID *</label>
              <input
                type="text"
                className="form-input"
                required
                value={pcoApplicationId}
                onChange={(e) => setPcoApplicationId(e.target.value)}
                placeholder="e.g. ca01c8be17ad11d4f90e879841eae..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">PCO Secret (Personal Access Token) *</label>
              <input
                type="password"
                className="form-input"
                required
                value={pcoSecret}
                onChange={(e) => setPcoSecret(e.target.value)}
                placeholder="••••••••••••••••••••••••••••••••"
              />
            </div>

            {saveSuccess && (
              <div style={{ color: "#22c55e", fontSize: "14px", fontWeight: "bold", background: "rgba(34, 197, 94, 0.1)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(34, 197, 94, 0.2)" }}>
                ✓ Planning Center settings saved successfully!
              </div>
            )}

            {saveError && (
              <div style={{ color: "#ef4444", fontSize: "14px", fontWeight: "bold", background: "rgba(239, 68, 68, 0.1)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                ⚠️ {saveError}
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={isSaving} style={{ width: "auto", alignSelf: "flex-end" }}>
              {isSaving ? "Saving Settings..." : "Save PCO Settings"}
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
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
              {/* App Logo Light Mode */}
              <div className="form-group" style={{ flex: 1, minWidth: "260px" }}>
                <label className="form-label">App Logo (Light Mode)</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "20px", border: "1px solid var(--border-color)", borderRadius: "8px", background: "rgba(255,255,255,0.01)" }}>
                  {logoLight ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <img src={logoLight} alt="Light logo preview" style={{ maxHeight: "40px", maxWidth: "160px", objectFit: "contain", background: "#f0f0f0", padding: "4px", borderRadius: "4px" }} />
                      <button type="button" className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "12px", width: "auto", color: "#ef4444" }} onClick={(e) => clearLogo("light", e)}>Remove</button>
                    </div>
                  ) : (
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>No logo uploaded</span>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    id="logo-light-file-input"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleLogoUpload("light", e.target.files[0]);
                    }}
                    style={{ display: "none" }}
                  />
                  <button type="button" className="btn btn-secondary" style={{ padding: "8px 16px", fontSize: "13px", width: "auto" }} onClick={() => document.getElementById("logo-light-file-input")?.click()}>
                    Upload Logo
                  </button>
                </div>
              </div>

              {/* App Logo Dark Mode */}
              <div className="form-group" style={{ flex: 1, minWidth: "260px" }}>
                <label className="form-label">App Logo (Dark Mode)</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "20px", border: "1px solid var(--border-color)", borderRadius: "8px", background: "rgba(255,255,255,0.01)" }}>
                  {logoDark ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <img src={logoDark} alt="Dark logo preview" style={{ maxHeight: "40px", maxWidth: "160px", objectFit: "contain", background: "#18181b", padding: "4px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "4px" }} />
                      <button type="button" className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "12px", width: "auto", color: "#ef4444" }} onClick={(e) => clearLogo("dark", e)}>Remove</button>
                    </div>
                  ) : (
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>No logo uploaded</span>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    id="logo-dark-file-input"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleLogoUpload("dark", e.target.files[0]);
                    }}
                    style={{ display: "none" }}
                  />
                  <button type="button" className="btn btn-secondary" style={{ padding: "8px 16px", fontSize: "13px", width: "auto" }} onClick={() => document.getElementById("logo-dark-file-input")?.click()}>
                    Upload Logo
                  </button>
                </div>
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

      {activeTab === "organizations" && (
        <div className="card-glass" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <h2 style={{ marginBottom: "12px" }}>Organization Branding Customization</h2>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 10px 0" }}>
            Upload Light and Dark mode logo images for individual organizations. Synced templates belonging to these organizations will automatically display these logos.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {orgs.map((org) => (
              <div key={org.id} style={{ display: "flex", flexWrap: "wrap", gap: "20px", padding: "20px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "rgba(255,255,255,0.01)" }}>
                <div style={{ flex: "1 1 200px" }}>
                  <h3 style={{ fontSize: "16px", margin: 0 }}>{org.name}</h3>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>ID: {org.id}</span>
                </div>
                {/* Light Logo Uploader */}
                <div style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>Light Mode Logo</label>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {org.logoLight ? (
                      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "8px" }}>
                        <img src={org.logoLight} alt="Light logo preview" style={{ maxHeight: "36px", maxWidth: "120px", objectFit: "contain", background: "#f0f0f0", padding: "4px", borderRadius: "4px" }} />
                        <button type="button" className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: "11px", width: "auto", color: "#ef4444" }} onClick={() => handleOrgLogoClear(org.id, "light")}>Remove</button>
                      </div>
                    ) : (
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>No logo uploaded</span>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      id={`org-logo-light-${org.id}`}
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleOrgLogoUpload(org.id, "light", e.target.files[0]);
                      }}
                      style={{ display: "none" }}
                    />
                    <button type="button" className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "12px", width: "auto" }} onClick={() => document.getElementById(`org-logo-light-${org.id}`)?.click()}>
                      Upload
                    </button>
                  </div>
                </div>
                {/* Dark Logo Uploader */}
                <div style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>Dark Mode Logo</label>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {org.logoDark ? (
                      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "8px" }}>
                        <img src={org.logoDark} alt="Dark logo preview" style={{ maxHeight: "36px", maxWidth: "120px", objectFit: "contain", background: "#18181b", padding: "4px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "4px" }} />
                        <button type="button" className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: "11px", width: "auto", color: "#ef4444" }} onClick={() => handleOrgLogoClear(org.id, "dark")}>Remove</button>
                      </div>
                    ) : (
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>No logo uploaded</span>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      id={`org-logo-dark-${org.id}`}
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleOrgLogoUpload(org.id, "dark", e.target.files[0]);
                      }}
                      style={{ display: "none" }}
                    />
                    <button type="button" className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "12px", width: "auto" }} onClick={() => document.getElementById(`org-logo-dark-${org.id}`)?.click()}>
                      Upload
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
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

      {activeTab === "users" && (() => {
        // Group users by department
        const usersByDept = usersList.reduce((acc, user) => {
          const dept = user.department?.trim() || "Unassigned Department";
          if (!acc[dept]) {
            acc[dept] = [];
          }
          acc[dept].push(user);
          return acc;
        }, {} as Record<string, User[]>);

        return (
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
                  View users organized by department and synchronized from the Central IAM Portal.
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
                  disabled={isSyncing || isSyncingIam}
                  className="btn btn-secondary"
                  style={{ width: "auto" }}
                >
                  {isSyncing ? "Syncing..." : "Sync Directory"}
                </button>
                <button
                  type="button"
                  onClick={handleSyncIamRegistry}
                  disabled={isSyncing || isSyncingIam}
                  className="btn btn-primary"
                  style={{ width: "auto" }}
                >
                  {isSyncingIam ? "Syncing Registry..." : "Sync IAM Registry"}
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
                  ? `✓ Directory synchronized successfully! ${syncStatus.details || `Imported/Updated ${syncStatus.count} user configurations.`}`
                  : `⚠️ Sync failed: ${syncStatus.error}`}
              </div>
            )}

            {usersList.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                No users in directory. Click "Sync Directory" to fetch from central registry.
              </div>
            ) : (() => {
              const sortedDepts = Object.entries(usersByDept)
                .sort(([a], [b]) => a.localeCompare(b));

              // Helper function to create DOM element IDs safely
              const getDeptId = (name: string) => `dept-section-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

              // Helper function to handle scrolling to department
              const scrollToDept = (deptName: string) => {
                // Ensure the department is expanded
                setCollapsedDepts(prev => ({ ...prev, [deptName]: false }));
                setIsMobileDrawerOpen(false);

                // Scroll to target element
                setTimeout(() => {
                  const el = document.getElementById(getDeptId(deptName));
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }, 100);
              };

              // Side navigation lists JSX component
              const renderNavLinks = () => (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "bold", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", padding: "0 4px 8px 4px", borderBottom: "1px solid var(--border-color)", marginBottom: "8px" }}>
                    Departments
                  </span>
                  {sortedDepts.map(([dept, deptUsers]) => {
                    const isCollapsed = !!collapsedDepts[dept];
                    return (
                      <div
                        key={`nav-${dept}`}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 10px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          transition: "all var(--transition-fast)",
                          background: "transparent",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        onClick={() => scrollToDept(dept)}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "calc(100% - 30px)" }}>
                          <span style={{ fontSize: "14px", color: isCollapsed ? "var(--text-muted)" : "var(--primary-color)" }}>
                            {isCollapsed ? "📁" : "📂"}
                          </span>
                          <span style={{ fontSize: "13px", color: isCollapsed ? "var(--text-muted)" : "var(--text-main)", fontWeight: isCollapsed ? "400" : "600", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {dept}
                          </span>
                        </div>
                        <span style={{ fontSize: "11px", background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: "10px", color: "var(--text-muted)", flexShrink: 0 }}>
                          {deptUsers.length}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );

              return (
                <div>
                  {/* Mobile Hamburger Button */}
                  <button
                    type="button"
                    className="directory-mobile-hamburger-btn"
                    onClick={() => setIsMobileDrawerOpen(true)}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="3" y1="12" x2="21" y2="12" />
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                    <span>Departments ({sortedDepts.length})</span>
                  </button>

                  {/* Mobile Slide-out Drawer */}
                  {isMobileDrawerOpen && (
                    <div className="drawer-backdrop" onClick={() => setIsMobileDrawerOpen(false)}>
                      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", marginBottom: "12px" }}>
                          <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: 0 }}>Directory Menu</h3>
                          <button
                            type="button"
                            onClick={() => setIsMobileDrawerOpen(false)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "var(--text-muted)",
                              fontSize: "18px",
                              cursor: "pointer",
                              padding: "4px 8px"
                            }}
                          >
                            ✕
                          </button>
                        </div>
                        <div style={{ flex: 1, overflowY: "auto" }}>
                          {renderNavLinks()}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="directory-layout">
                    {/* Desktop Sidebar Navigation */}
                    <div className="directory-sidebar">
                      {renderNavLinks()}
                    </div>

                    {/* Directory Main List Content */}
                    <div className="directory-content">
                      {sortedDepts.map(([dept, deptUsers]) => {
                        const sortedDeptUsers = getSortedUsers(deptUsers);
                        const isCollapsed = !!collapsedDepts[dept];
                        const cleanId = getDeptId(dept);

                        return (
                          <div
                            key={dept}
                            id={cleanId}
                            style={{
                              marginBottom: "32px",
                              border: "1px solid var(--border-color)",
                              borderRadius: "8px",
                              padding: "16px",
                              background: "rgba(255,255,255,0.01)",
                              transition: "all 0.3s ease"
                            }}
                          >
                            {/* Collapsible Header */}
                            <h3
                              onClick={() => setCollapsedDepts(prev => ({ ...prev, [dept]: !prev[dept] }))}
                              style={{
                                margin: 0,
                                paddingBottom: "12px",
                                borderBottom: isCollapsed ? "none" : "1px solid var(--border-color)",
                                color: "var(--primary-color)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                cursor: "pointer",
                                userSelect: "none"
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <span style={{ transition: "transform 0.2s ease", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)", display: "inline-block" }}>
                                  ▼
                                </span>
                                <span>📁 {dept}</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <span style={{ fontSize: "12px", background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: "10px", color: "var(--text-muted)" }}>
                                  {deptUsers.length} {deptUsers.length === 1 ? "User" : "Users"}
                                </span>
                                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                  {isCollapsed ? "Click to Expand" : "Click to Collapse"}
                                </span>
                              </div>
                            </h3>

                            {/* Collapsible Table Content */}
                            {!isCollapsed && (
                              <div style={{ overflowX: "auto", marginTop: "16px", animation: "fadeIn 0.25s ease-out" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
                                    <thead>
                                      <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
                                        <th style={{ padding: "12px 8px", cursor: "pointer", userSelect: "none" }} onClick={() => handleUserSort("name")}>
                                          Name {userSortBy === "name" ? (userSortOrder === "asc" ? " ▲" : " ▼") : " ↕"}
                                        </th>
                                        <th style={{ padding: "12px 8px", cursor: "pointer", userSelect: "none" }} onClick={() => handleUserSort("email")}>
                                          Email {userSortBy === "email" ? (userSortOrder === "asc" ? " ▲" : " ▼") : " ↕"}
                                        </th>
                                        <th style={{ padding: "12px 8px" }}>Organizations</th>
                                        <th style={{ padding: "12px 8px", cursor: "pointer", userSelect: "none" }} onClick={() => handleUserSort("role")}>
                                          Assigned Role {userSortBy === "role" ? (userSortOrder === "asc" ? " ▲" : " ▼") : " ↕"}
                                        </th>
                                        <th style={{ padding: "12px 8px" }}>Override Status</th>
                                        <th style={{ padding: "12px 8px", textAlign: "right" }}>Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {sortedDeptUsers.map((u) => (
                                        <tr
                                          key={u.id}
                                          style={{
                                            borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
                                            transition: "background var(--transition-fast)",
                                          }}
                                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.015)")}
                                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                                        >
                                          <td style={{ padding: "12px 8px", fontWeight: "500" }}>{u.name || "—"}</td>
                                          <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "var(--text-muted)" }}>
                                            {u.email}
                                          </td>
                                          <td style={{ padding: "12px 8px" }}>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                              {u.organizations.length === 0 ? (
                                                <span style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>None</span>
                                              ) : (
                                                u.organizations.map((org: any) => (
                                                  <span
                                                    key={org.id}
                                                    style={{
                                                      fontSize: "11px",
                                                      background: "rgba(255, 255, 255, 0.04)",
                                                      padding: "2px 6px",
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
                                            <select
                                              value={u.role}
                                              disabled={updatingUserId === u.id}
                                              onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                              style={{
                                                background: "rgba(255, 255, 255, 0.05)",
                                                border: "1px solid rgba(255, 255, 255, 0.1)",
                                                borderRadius: "4px",
                                                color: u.role === "Admin" ? "#f87171" : u.role === "OrgLeader" ? "#facc15" : "var(--text-main)",
                                                padding: "4px 8px",
                                                fontSize: "13px",
                                                cursor: "pointer",
                                                outline: "none",
                                                fontWeight: "600",
                                              }}
                                            >
                                              <option value="Admin" style={{ background: "#1e1e2e", color: "#f87171" }}>Admin</option>
                                              <option value="OrgLeader" style={{ background: "#1e1e2e", color: "#facc15" }}>OrgLeader</option>
                                              <option value="User" style={{ background: "#1e1e2e", color: "var(--text-main)" }}>User</option>
                                            </select>
                                          </td>
                                          <td style={{ padding: "12px 8px" }}>
                                            {u.roleOverride ? (
                                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                <span style={{ fontSize: "11px", background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold" }}>
                                                  Manual
                                                </span>
                                                <button
                                                  disabled={updatingUserId === u.id}
                                                  onClick={() => handleResetOverride(u.id)}
                                                  className="btn btn-secondary"
                                                  style={{ padding: "2px 6px", fontSize: "11px", width: "auto" }}
                                                >
                                                  Reset
                                                </button>
                                              </div>
                                            ) : (
                                              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>
                                                Auto (SSO)
                                              </span>
                                            )}
                                          </td>
                                          <td style={{ padding: "12px 8px", textAlign: "right" }}>
                                            <div style={{ display: "inline-flex", gap: "8px", alignItems: "center", justifyContent: "flex-end" }}>
                                              <button
                                                disabled={updatingUserId === u.id || u.role === "Admin"}
                                                onClick={() => handleImpersonate(u.id)}
                                                className="btn btn-secondary"
                                                style={{
                                                  padding: "4px 8px",
                                                  fontSize: "12px",
                                                  borderRadius: "4px",
                                                  width: "auto",
                                                  background: "rgba(139, 92, 246, 0.1)",
                                                  color: "#a78bfa",
                                                  border: "1px solid rgba(139, 92, 246, 0.2)",
                                                }}
                                              >
                                                👁 Impersonate
                                              </button>

                                              {deleteConfirmId === u.id ? (
                                                <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                                                  <button
                                                    onClick={() => handleDeleteUser(u.id)}
                                                    disabled={updatingUserId === u.id}
                                                    className="btn"
                                                    style={{
                                                      padding: "4px 8px",
                                                      fontSize: "12px",
                                                      borderRadius: "4px",
                                                      width: "auto",
                                                      background: "#ef4444",
                                                      color: "#ffffff",
                                                      border: "none",
                                                    }}
                                                  >
                                                    Confirm
                                                  </button>
                                                  <button
                                                    onClick={() => setDeleteConfirmId(null)}
                                                    className="btn btn-secondary"
                                                    style={{
                                                      padding: "4px 8px",
                                                      fontSize: "12px",
                                                      borderRadius: "4px",
                                                      width: "auto",
                                                    }}
                                                  >
                                                    Cancel
                                                  </button>
                                                </div>
                                              ) : (
                                                <button
                                                  disabled={updatingUserId === u.id || u.role === "Admin"}
                                                  onClick={() => triggerDeleteConfirm(u.id)}
                                                  className="btn"
                                                  style={{
                                                    padding: "4px 8px",
                                                    fontSize: "12px",
                                                    borderRadius: "4px",
                                                    width: "auto",
                                                    background: "rgba(239, 68, 68, 0.1)",
                                                    color: "#f87171",
                                                    border: "1px solid rgba(239, 68, 68, 0.2)",
                                                  }}
                                                >
                                                  Delete
                                                </button>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

    </div>
  );
}
