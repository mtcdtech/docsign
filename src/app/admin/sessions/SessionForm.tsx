"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Org {
  id: string;
  name: string;
}

interface TemplateShort {
  id: string;
  title: string;
  organizationId: string;
}

interface SessionData {
  id: string;
  title: string;
  slug: string;
  organizationId: string;
  templateIds: string[];
}

interface SessionFormProps {
  organizations: Org[];
  templates: TemplateShort[];
  session?: SessionData;
}

export default function SessionForm({ organizations, templates, session }: SessionFormProps) {
  const router = useRouter();
  const isEdit = !!session;

  const [title, setTitle] = useState(session?.title || "");
  const [slug, setSlug] = useState(session?.slug || "");
  const [organizationId, setOrganizationId] = useState(
    session?.organizationId || organizations[0]?.id || ""
  );
  
  // Array of selected template IDs in ordered sequence
  const [selectedIds, setSelectedIds] = useState<string[]>(session?.templateIds || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-slugify title
  useEffect(() => {
    if (!isEdit && title) {
      const autoSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "") // remove special chars
        .replace(/\s+/g, "-") // spaces to hyphens
        .replace(/-+/g, "-") // collapse multiple hyphens
        .trim();
      setSlug(autoSlug);
    }
  }, [title, isEdit]);

  // When organization changes, reset template selections
  const handleOrgChange = (newOrgId: string) => {
    setOrganizationId(newOrgId);
    setSelectedIds([]);
  };

  // Filter templates belonging to the selected organization
  const orgTemplates = templates.filter((t) => t.organizationId === organizationId);

  // Handle checking/unchecking template checkboxes
  const handleToggleTemplate = (templateId: string, checked: boolean) => {
    if (checked) {
      // Append to the end of the order
      setSelectedIds((prev) => [...prev, templateId]);
    } else {
      // Filter out
      setSelectedIds((prev) => prev.filter((id) => id !== templateId));
    }
  };

  // Move template Up in sequence
  const moveUp = (index: number) => {
    if (index === 0) return;
    setSelectedIds((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[index - 1];
      copy[index - 1] = temp;
      return copy;
    });
  };

  // Move template Down in sequence
  const moveDown = (index: number) => {
    if (index === selectedIds.length - 1) return;
    setSelectedIds((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[index + 1];
      copy[index + 1] = temp;
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !slug.trim() || !organizationId) {
      setError("Please fill out all required fields.");
      return;
    }

    if (selectedIds.length === 0) {
      setError("Please select at least one template to include in this session.");
      return;
    }

    setLoading(true);

    try {
      const url = isEdit ? `/api/admin/sessions/${session.id}` : "/api/admin/sessions";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          slug,
          organizationId,
          templateIds: selectedIds
        })
      });

      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "Failed to save session configuration.");
      }

      router.push("/admin/sessions");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card-glass" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {error && (
        <div style={{ padding: "12px 16px", borderRadius: "6px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid #ef4444", color: "#f87171", fontSize: "13px" }}>
          ⚠️ {error}
        </div>
      )}

      {/* Title */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <label style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: "600" }}>Session Title *</label>
        <input
          type="text"
          className="form-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Youth Retreat Registration Packet"
          required
          style={{ padding: "10px 14px", fontSize: "14px" }}
        />
      </div>

      {/* Slug & Org */}
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        {/* Slug */}
        <div style={{ flex: 1, minWidth: "260px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: "600" }}>Public URL Slug *</label>
          <input
            type="text"
            className="form-input"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            placeholder="e.g. retreat-packet-2026"
            required
            style={{ padding: "10px 14px", fontSize: "14px" }}
          />
        </div>

        {/* Organization */}
        <div style={{ flex: 1, minWidth: "260px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: "600" }}>Organization *</label>
          <select
            className="form-input"
            value={organizationId}
            onChange={(e) => handleOrgChange(e.target.value)}
            disabled={isEdit}
            style={{ padding: "10px 14px", fontSize: "14px", cursor: isEdit ? "not-allowed" : "pointer" }}
          >
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid var(--border-color)", margin: "10px 0" }} />

      {/* Template Chooser Panel */}
      <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
        {/* Available templates Checklist */}
        <div style={{ flex: 1, minWidth: "280px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <h3 style={{ fontSize: "14px", margin: 0, color: "var(--text-main)" }}>Select Templates to Include</h3>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 10px 0" }}>
            Check the waiver forms that belong to this signing session.
          </p>

          {orgTemplates.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: "13px", fontStyle: "italic", padding: "12px", background: "rgba(255,255,255,0.01)", borderRadius: "6px", border: "1px dashed var(--border-color)" }}>
              No templates available for this organization. Create templates first.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "280px", overflowY: "auto", paddingRight: "4px" }}>
              {orgTemplates.map((t) => {
                const isSelected = selectedIds.includes(t.id);
                return (
                  <label
                    key={t.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 14px",
                      borderRadius: "6px",
                      background: isSelected ? "rgba(79, 70, 229, 0.04)" : "rgba(255,255,255,0.01)",
                      border: "1px solid " + (isSelected ? "var(--primary-color)" : "var(--border-color)"),
                      cursor: "pointer",
                      fontSize: "13px",
                      transition: "all var(--transition-fast)"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleToggleTemplate(t.id, e.target.checked)}
                      style={{ width: "16px", height: "16px", accentColor: "var(--primary-color)", cursor: "pointer" }}
                    />
                    <span style={{ fontWeight: isSelected ? "600" : "400", color: isSelected ? "var(--text-main)" : "var(--text-muted)" }}>
                      {t.title}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Sequence Order Panel */}
        <div style={{ flex: 1, minWidth: "280px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <h3 style={{ fontSize: "14px", margin: 0, color: "var(--text-main)" }}>Set Sequence Order</h3>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 10px 0" }}>
            Reorder the sequence of execution using Up and Down arrows.
          </p>

          {selectedIds.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "30px 10px", border: "1px dashed var(--border-color)", borderRadius: "6px" }}>
              No templates selected. Check forms on the left to start ordering.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {selectedIds.map((id, index) => {
                const tpl = templates.find((t) => t.id === id);
                return (
                  <div
                    key={id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      background: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "6px"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "11px", background: "var(--primary-color)", color: "#ffffff", width: "20px", height: "20px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
                        {index + 1}
                      </span>
                      <span style={{ fontSize: "13px", color: "var(--text-main)", fontWeight: "500" }}>
                        {tpl ? tpl.title : "Unknown Template"}
                      </span>
                    </div>

                    {/* Order Controls */}
                    <div style={{ display: "flex", gap: "4px" }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => moveUp(index)}
                        disabled={index === 0}
                        style={{ padding: "4px 8px", width: "28px", height: "28px", fontSize: "12px", opacity: index === 0 ? 0.3 : 1 }}
                        title="Move Up"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => moveDown(index)}
                        disabled={index === selectedIds.length - 1}
                        style={{ padding: "4px 8px", width: "28px", height: "28px", fontSize: "12px", opacity: index === selectedIds.length - 1 ? 0.3 : 1 }}
                        title="Move Down"
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid var(--border-color)", margin: "10px 0" }} />

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => router.push("/admin/sessions")}
          disabled={loading}
          style={{ width: "auto", padding: "10px 20px" }}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn"
          disabled={loading}
          style={{
            background: "var(--primary-color)",
            color: "#ffffff",
            width: "auto",
            padding: "10px 24px",
            fontWeight: "600",
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? "Saving..." : isEdit ? "Save Changes" : "Create Session"}
        </button>
      </div>
    </form>
  );
}
