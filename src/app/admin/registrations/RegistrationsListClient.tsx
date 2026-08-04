"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface RegistrationWithDetails {
  id: string;
  title: string;
  slug: string;
  isArchived: boolean;
  createdAt: string | Date;
  organizationId: string;
  organization: {
    name: string;
  };
  templateTitles: string[];
  pcoSignupId: string | null;
}

interface RegistrationsListClientProps {
  initialRegistrations: RegistrationWithDetails[];
}

export default function RegistrationsListClient({ initialRegistrations }: RegistrationsListClientProps) {
  const router = useRouter();
  const [registrations, setRegistrations] = useState<RegistrationWithDetails[]>(initialRegistrations);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "active" | "archived">("active");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Handle URL Copy
  const handleCopyLink = (slug: string, id: string) => {
    if (typeof window !== "undefined") {
      const shareUrl = `${window.location.origin}/registration/${slug}`;
      navigator.clipboard.writeText(shareUrl);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Toggle Archive Status
  const handleToggleArchive = async (reg: RegistrationWithDetails) => {
    try {
      const res = await fetch(`/api/admin/registrations/${reg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: !reg.isArchived })
      });
      
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "Failed to update registration status.");
      }

      setRegistrations((prev) =>
        prev.map((s) => (s.id === reg.id ? { ...s, isArchived: !s.isArchived } : s))
      );
      router.refresh();
    } catch (err: any) {
      alert(err.message || "An error occurred while updating the registration.");
    }
  };

  // Handle Delete Registration
  const handleDeleteRegistration = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this signing registration packet? This action cannot be undone.")) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/registrations/${id}`, {
        method: "DELETE"
      });

      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "Failed to delete registration.");
      }

      setRegistrations((prev) => prev.filter((s) => s.id !== id));
      router.refresh();
    } catch (err: any) {
      alert(err.message || "An error occurred while deleting the registration.");
    }
  };

  // Filter registrations based on search query and tab
  const filteredRegistrations = registrations.filter((reg) => {
    const matchesSearch =
      reg.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reg.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reg.organization.name.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterTab === "active") return !reg.isArchived;
    if (filterTab === "archived") return reg.isArchived;
    return true;
  });

  return (
    <div className="card-glass" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Search and Filter Controls */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
        {/* Filters */}
        <div style={{ display: "flex", gap: "8px", background: "rgba(255,255,255,0.03)", padding: "4px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
          <button
            type="button"
            className="btn"
            onClick={() => setFilterTab("active")}
            style={{
              padding: "6px 16px",
              fontSize: "13px",
              background: filterTab === "active" ? "var(--primary-color)" : "transparent",
              color: filterTab === "active" ? "#ffffff" : "var(--text-muted)",
              width: "auto"
            }}
          >
            Active Registrations
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setFilterTab("archived")}
            style={{
              padding: "6px 16px",
              fontSize: "13px",
              background: filterTab === "archived" ? "var(--primary-color)" : "transparent",
              color: filterTab === "archived" ? "#ffffff" : "var(--text-muted)",
              width: "auto"
            }}
          >
            Archived
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setFilterTab("all")}
            style={{
              padding: "6px 16px",
              fontSize: "13px",
              background: filterTab === "all" ? "var(--primary-color)" : "transparent",
              color: filterTab === "all" ? "#ffffff" : "var(--text-muted)",
              width: "auto"
            }}
          >
            All
          </button>
        </div>

        {/* Search */}
        <div style={{ position: "relative", minWidth: "260px" }}>
          <input
            type="text"
            className="form-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search registrations..."
            style={{ padding: "8px 12px 8px 36px", fontSize: "13px", width: "100%" }}
          />
          <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: "14px" }}>
            🔍
          </span>
        </div>
      </div>

      {/* Registrations Table */}
      {filteredRegistrations.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>📂</div>
          <p>No signing registration packets found matching your filter criteria.</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                <th style={{ padding: "12px", fontSize: "12px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase" }}>Registration Details</th>
                <th style={{ padding: "12px", fontSize: "12px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase" }}>Organization</th>
                <th style={{ padding: "12px", fontSize: "12px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase" }}>Templates in Order</th>
                <th style={{ padding: "12px", fontSize: "12px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase" }}>Public Link</th>
                <th style={{ padding: "12px", fontSize: "12px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRegistrations.map((reg) => (
                <tr key={reg.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", transition: "background var(--transition-fast)" }}>
                  <td style={{ padding: "16px 12px" }}>
                    <Link href={`/admin/registrations/${reg.id}`} style={{ textDecoration: "none" }}>
                      <div style={{ fontWeight: "600", fontSize: "14px", color: "var(--text-main)", cursor: "pointer", transition: "color var(--transition-fast)" }} className="reg-title-link">
                        {reg.title}
                      </div>
                    </Link>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <span>Created: {new Date(reg.createdAt).toLocaleDateString()}</span>
                      {reg.pcoSignupId && (
                        <span style={{ color: "var(--primary-color)", fontWeight: "bold" }}>
                          🔗 PCO Connected ({reg.pcoSignupId})
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "16px 12px", fontSize: "13px" }}>
                    <span style={{ background: "rgba(255, 255, 255, 0.05)", padding: "4px 8px", borderRadius: "4px", fontSize: "12px" }}>
                      {reg.organization.name}
                    </span>
                  </td>
                  <td style={{ padding: "16px 12px", maxWidth: "280px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {reg.templateTitles.map((title, idx) => (
                        <span
                          key={idx}
                          style={{
                            background: "rgba(79, 70, 229, 0.12)",
                            color: "#818cf8",
                            border: "1px solid rgba(79, 70, 229, 0.2)",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: "500"
                          }}
                        >
                          {idx + 1}. {title}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: "16px 12px" }}>
                    <button
                      type="button"
                      onClick={() => handleCopyLink(reg.slug, reg.id)}
                      className="btn btn-secondary"
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        width: "auto",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        background: copiedId === reg.id ? "rgba(16, 185, 129, 0.15)" : "transparent",
                        borderColor: copiedId === reg.id ? "#10b981" : "var(--border-color)",
                        color: copiedId === reg.id ? "#34d399" : "var(--text-muted)"
                      }}
                    >
                      {copiedId === reg.id ? "✅ Copied" : "📋 Copy Link"}
                    </button>
                  </td>
                  <td style={{ padding: "16px 12px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                      <Link
                        href={`/admin/registrations/${reg.id}/edit`}
                        className="btn btn-secondary"
                        style={{ padding: "6px 12px", fontSize: "12px", width: "auto" }}
                      >
                        ✏️ Edit
                      </Link>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleToggleArchive(reg)}
                        style={{ padding: "6px 12px", fontSize: "12px", width: "auto" }}
                      >
                        {reg.isArchived ? "🔓 Restore" : "🗄️ Archive"}
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => handleDeleteRegistration(reg.id)}
                        style={{ padding: "6px 12px", fontSize: "12px", width: "auto", color: "#ef4444" }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <style jsx global>{`
        .reg-title-link:hover {
          color: var(--primary-color) !important;
        }
      `}</style>
    </div>
  );
}
