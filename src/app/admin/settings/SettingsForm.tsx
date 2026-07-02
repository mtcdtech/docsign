"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

interface SettingsFormProps {
  initialPrimaryColor: string;
  initialPrimaryHover: string;
  initialPortalTitle: string;
}

export default function SettingsForm({
  initialPrimaryColor,
  initialPrimaryHover,
  initialPortalTitle,
}: SettingsFormProps) {
  const router = useRouter();
  const [primaryColor, setPrimaryColor] = useState(initialPrimaryColor);
  const [primaryHover, setPrimaryHover] = useState(initialPrimaryHover);
  const [portalTitle, setPortalTitle] = useState(initialPortalTitle);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
    } catch (err: any) {
      setSaveError(err.message || "An error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
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
  );
}
