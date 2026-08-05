"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ChecklistItem {
  templateId: string;
  title: string;
  pcoQuestionTitle: string | null;
  signed: boolean;
  pcoAnswered: boolean;
}

interface Attendee {
  id: string;
  name: string;
  email: string;
  checklist: ChecklistItem[];
  status: string;
}

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
  portalTimezone?: string;
}

function RegistrationCard({
  reg,
  handleCopyLink,
  copiedId,
  handleToggleArchive,
  handleDeleteRegistration,
  portalTimezone
}: {
  reg: RegistrationWithDetails;
  handleCopyLink: (slug: string, id: string) => void;
  copiedId: string | null;
  handleToggleArchive: (reg: RegistrationWithDetails) => void;
  handleDeleteRegistration: (id: string) => void;
  portalTimezone: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const fetchAttendees = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/registrations/${reg.id}/pco`);
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "Failed to load PCO data.");
      }
      setAttendees(data.attendees || []);
    } catch (err: any) {
      setError(err.message || "PCO API Connection Issue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isExpanded && reg.pcoSignupId) {
      fetchAttendees();
    }
  }, [isExpanded]);

  const handleSync = async (att: Attendee) => {
    setSyncingId(att.id);
    try {
      const res = await fetch(`/api/admin/registrations/${reg.id}/pco`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: att.email, name: att.name })
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "Failed to sync check-off.");
      }
      fetchAttendees();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="card-glass" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px", border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.015)" }}>
      {/* Card Header Info */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div style={{ flex: 1, minWidth: "240px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <h3 style={{ fontSize: "16px", margin: 0, fontWeight: "700" }}>{reg.title}</h3>
            <span style={{ background: "rgba(255, 255, 255, 0.05)", padding: "2px 8px", borderRadius: "4px", fontSize: "11px", color: "var(--text-muted)" }}>
              {reg.organization.name}
            </span>
          </div>
          <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "6px", display: "flex", flexWrap: "wrap", gap: "12px" }}>
            <span>Created: {new Date(reg.createdAt).toLocaleDateString("en-US", { timeZone: portalTimezone })}</span>
            {reg.pcoSignupId ? (
              <span style={{ color: "var(--primary-color)", fontWeight: "bold" }}>
                🔗 PCO connected (ID: {reg.pcoSignupId})
              </span>
            ) : (
              <span style={{ fontStyle: "italic" }}>No PCO connected</span>
            )}
          </div>
        </div>

        {/* Card Actions */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          {reg.pcoSignupId && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsExpanded(!isExpanded)}
              style={{
                padding: "6px 12px",
                fontSize: "12.5px",
                width: "auto",
                background: isExpanded ? "rgba(79, 70, 229, 0.1)" : "transparent",
                borderColor: isExpanded ? "var(--primary-color)" : "var(--border-color)",
                color: isExpanded ? "#818cf8" : "var(--text-muted)"
              }}
            >
              {isExpanded ? "🔽 Hide PCO Table" : "🔌 Show PCO Table"}
            </button>
          )}
          <a
            href={`/registration/${reg.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{
              padding: "6px 12px",
              fontSize: "12.5px",
              width: "auto",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center"
            }}
          >
            🔗 Open Link
          </a>
          <button
            type="button"
            onClick={() => handleCopyLink(reg.slug, reg.id)}
            className="btn btn-secondary"
            style={{
              padding: "6px 12px",
              fontSize: "12.5px",
              width: "auto",
              background: copiedId === reg.id ? "rgba(16, 185, 129, 0.15)" : "transparent",
              borderColor: copiedId === reg.id ? "#10b981" : "var(--border-color)",
              color: copiedId === reg.id ? "#34d399" : "var(--text-muted)"
            }}
          >
            {copiedId === reg.id ? "✅ Copied" : "📋 Copy Link"}
          </button>
          <Link
            href={`/admin/registrations/${reg.id}/edit`}
            className="btn btn-secondary"
            style={{ padding: "6px 12px", fontSize: "12.5px", width: "auto" }}
          >
            ✏️ Edit
          </Link>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleToggleArchive(reg)}
            style={{ padding: "6px 12px", fontSize: "12.5px", width: "auto" }}
          >
            {reg.isArchived ? "🔓 Restore" : "🗄️ Archive"}
          </button>
          {reg.isArchived && (
            <button
              type="button"
              className="btn"
              onClick={() => handleDeleteRegistration(reg.id)}
              style={{ padding: "6px 12px", fontSize: "12.5px", width: "auto", color: "#ef4444" }}
            >
              🗑️ Delete
            </button>
          )}
        </div>
      </div>

      {/* Templates Sequence indicators */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", borderTop: "1px solid rgba(255,255,255,0.03)", paddingTop: "12px" }}>
        <span style={{ fontSize: "11px", color: "var(--text-muted)", alignSelf: "center", marginRight: "4px" }}>Sequence:</span>
        {reg.templateTitles.map((title, idx) => (
          <span
            key={idx}
            style={{
              background: "rgba(79, 70, 229, 0.08)",
              color: "#a5b4fc",
              border: "1px solid rgba(79, 70, 229, 0.15)",
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

      {/* Collapsible PCO table */}
      {isExpanded && reg.pcoSignupId && (
        <div style={{ borderTop: "1px solid var(--border-color)", marginTop: "8px", paddingTop: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h4 style={{ fontSize: "13px", margin: 0, color: "var(--text-main)" }}>Planning Center Online Registrants Dashboard</h4>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={fetchAttendees}
              disabled={loading}
              style={{ padding: "3px 8px", fontSize: "11px", width: "auto" }}
            >
              🔄 Refresh List
            </button>
          </div>
          
          {loading ? (
            <div style={{ color: "var(--text-muted)", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px", padding: "10px" }}>
              <div className="spinner-mini" style={{ border: "2px solid rgba(255,255,255,0.1)", borderTop: "2px solid var(--primary-color)", borderRadius: "50%", width: "14px", height: "14px", animation: "spin 1s linear infinite" }} />
              <span>Loading attendees...</span>
            </div>
          ) : error ? (
            <div style={{ color: "#f87171", fontSize: "12px", background: "rgba(239, 68, 68, 0.1)", padding: "10px", borderRadius: "6px" }}>
              ⚠️ {error} (Check PCO Credentials in Stack Environment settings)
            </div>
          ) : attendees.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: "12px", padding: "10px", fontStyle: "italic" }}>
              No attendees registered in PCO yet.
            </div>
          ) : (
            <div style={{ overflowX: "auto", maxHeight: "300px", background: "transparent", borderRadius: "6px", border: "1px solid var(--border-color)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color)", background: "rgba(255,255,255,0.01)", color: "var(--text-muted)" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Name</th>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Email</th>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Forms Completion Status</th>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Status</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {attendees.map((att) => (
                    <tr key={att.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                      <td style={{ padding: "10px 12px", fontWeight: "600" }}>{att.name}</td>
                      <td style={{ padding: "10px 12px", color: "var(--text-muted)" }}>{att.email}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          {att.checklist.map((item) => (
                            <div key={item.templateId} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ color: item.signed ? "#10b981" : "#ef4444" }}>
                                {item.signed ? "✓" : "✗"}
                              </span>
                              <span>{item.title}</span>
                              {item.pcoQuestionTitle && (
                                <span style={{ fontSize: "9px", opacity: 0.8, color: item.pcoAnswered ? "#34d399" : "#f87171" }}>
                                  ({item.pcoAnswered ? "Synced" : "Not Synced"})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontSize: "10px",
                          fontWeight: "bold",
                          background: att.status === "Completed" ? "rgba(16,185,129,0.12)" : att.status.startsWith("Partial") ? "rgba(250,204,21,0.12)" : "rgba(255,255,255,0.04)",
                          color: att.status === "Completed" ? "#34d399" : att.status.startsWith("Partial") ? "#fde047" : "var(--text-muted)"
                        }}>
                          {att.status}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => handleSync(att)}
                          disabled={syncingId !== null || att.checklist.every((c) => !c.signed)}
                          className="btn btn-secondary"
                          style={{ padding: "4px 8px", fontSize: "11px", width: "auto" }}
                        >
                          {syncingId === att.id ? "Syncing..." : "Sync PCO"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RegistrationsListClient({ initialRegistrations, portalTimezone = "America/Chicago" }: RegistrationsListClientProps) {
  const router = useRouter();
  const [registrations, setRegistrations] = useState<RegistrationWithDetails[]>(initialRegistrations);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"active" | "archived" | "all">("active");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Handle URL Copy
  const handleCopyLink = (slug: string, id: string) => {
    if (typeof window !== "undefined") {
      const shareUrl = `${window.location.origin}/registration/${slug}`;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl)
          .then(() => {
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
          })
          .catch(() => fallbackCopy(shareUrl, id));
      } else {
        fallbackCopy(shareUrl, id);
      }
    }
  };

  const fallbackCopy = (text: string, id: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand("copy");
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Fallback copy failed", err);
    }
    document.body.removeChild(textArea);
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

      {/* Registrations list cards */}
      {filteredRegistrations.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>📂</div>
          <p>No signing registration packets found matching your filter criteria.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {filteredRegistrations.map((reg) => (
            <RegistrationCard
              key={reg.id}
              reg={reg}
              handleCopyLink={handleCopyLink}
              copiedId={copiedId}
              handleToggleArchive={handleToggleArchive}
              handleDeleteRegistration={handleDeleteRegistration}
              portalTimezone={portalTimezone}
            />
          ))}
        </div>
      )}
      
      <style jsx global>{`
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
        .spinner-mini {
          border: 2px solid rgba(255,255,255,0.1);
          border-top: 2px solid var(--primary-color);
          border-radius: 50%;
          width: 14px;
          height: 14px;
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
