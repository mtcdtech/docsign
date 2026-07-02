"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

interface SettingsFormProps {
  initialPrimaryColor: string;
  initialPrimaryHover: string;
  initialPortalTitle: string;
  initialLogoBase64: string;
  initialThemeMode: string;
  apiKey: string;
  rolesApiUrl: string;
}

export default function SettingsForm({
  initialPrimaryColor,
  initialPrimaryHover,
  initialPortalTitle,
  initialLogoBase64,
  initialThemeMode,
  apiKey,
  rolesApiUrl,
}: SettingsFormProps) {
  const router = useRouter();
  const [primaryColor, setPrimaryColor] = useState(initialPrimaryColor);
  const [primaryHover, setPrimaryHover] = useState(initialPrimaryHover);
  const [portalTitle, setPortalTitle] = useState(initialPortalTitle);
  const [logoBase64, setLogoBase64] = useState(initialLogoBase64);
  const [themeMode, setThemeMode] = useState(initialThemeMode);
  const [dragOver, setDragOver] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
    
    // File size limit - SQLite can handle large files but let's keep it under 2MB for standard favicon/logos
    if (file.size > 2 * 1024 * 1024) {
      setSaveError("File is too large. Please select an image smaller than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      if (uploadEvent.target?.result) {
        setLogoBase64(uploadEvent.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const clearLogo = (e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering file browse
    setLogoBase64("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          primary_color: primaryColor,
          primary_hover: primaryHover,
          portal_title: portalTitle,
          portal_logo: logoBase64,
          theme_mode: themeMode,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "Failed to save settings.");
      }

      setSaveSuccess(true);
      router.refresh();
      
      // Update variables in real time on this tab
      document.documentElement.style.setProperty("--primary-color", primaryColor);
      document.documentElement.style.setProperty("--primary-hover", primaryHover);
      
      // Update theme setting in real time
      document.documentElement.setAttribute("data-theme", themeMode);
      localStorage.setItem("theme-mode", themeMode);
    } catch (err: any) {
      setSaveError(err.message || "An error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="card-glass">
      <h2 style={{ marginBottom: "20px" }}>Visual Customization</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        
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
            style={{ background: "rgba(0,0,0,0.2)", cursor: "pointer", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", color: "var(--text-main)" }}
          >
            <option value="dark" style={{ background: "var(--bg-card)", color: "var(--text-main)" }}>Dark Mode</option>
            <option value="light" style={{ background: "var(--bg-card)", color: "var(--text-main)" }}>Light Mode</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Portal Logo</label>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={triggerFileInput}
            style={{
              border: `2px dashed ${dragOver ? "var(--primary-color)" : "var(--border-color)"}`,
              borderRadius: "var(--radius-md)",
              padding: "24px",
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
                  Custom logo uploaded. Drag and drop or click to replace.
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
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Supports PNG, JPG, or SVG (square/wide aspect ratio)</span>
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
            ✓ Branding styles and portal configurations saved successfully!
          </div>
        )}

        {saveError && (
          <div style={{ color: "#ef4444", fontSize: "14px", fontWeight: "bold", background: "rgba(239, 68, 68, 0.1)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
            ⚠️ {saveError}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSaving}
          style={{ width: "auto", alignSelf: "flex-end" }}
        >
          {isSaving ? "Saving Settings..." : "Save Theme Preferences"}
        </button>
      </form>
      </div>

      {/* Central IAM API Registry Info */}
      <div className="card-glass" style={{ marginTop: "32px" }}>
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
    </>
  );
}
