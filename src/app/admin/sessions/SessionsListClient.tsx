"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface SessionWithDetails {
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
}

interface SessionsListClientProps {
  initialSessions: SessionWithDetails[];
}

export default function SessionsListClient({ initialSessions }: SessionsListClientProps) {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionWithDetails[]>(initialSessions);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "active" | "archived">("active");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Handle URL Copy
  const handleCopyLink = (slug: string, id: string) => {
    if (typeof window !== "undefined") {
      const shareUrl = `${window.location.origin}/session/${slug}`;
      navigator.clipboard.writeText(shareUrl);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Toggle Archive Status
  const handleToggleArchive = async (session: SessionWithDetails) => {
    try {
      const res = await fetch(`/api/admin/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: !session.isArchived })
      });
      
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "Failed to update session status.");
      }

      setSessions((prev) =>
        prev.map((s) => (s.id === session.id ? { ...s, isArchived: !s.isArchived } : s))
      );
      router.refresh();
    } catch (err: any) {
      alert(err.message || "An error occurred while updating the session.");
    }
  };

  // Handle Delete Session
  const handleDeleteSession = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this signing session? This action cannot be undone.")) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/sessions/${id}`, {
        method: "DELETE"
      });

      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "Failed to delete session.");
      }

      setSessions((prev) => prev.filter((s) => s.id !== id));
      router.refresh();
    } catch (err: any) {
      alert(err.message || "An error occurred while deleting the session.");
    }
  };

  // Filter sessions based on search query and tab
  const filteredSessions = sessions.filter((session) => {
    const matchesSearch =
      session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.organization.name.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterTab === "active") return !session.isArchived;
    if (filterTab === "archived") return session.isArchived;
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
            Active Sessions
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
            placeholder="Search sessions..."
            style={{ padding: "8px 12px 8px 36px", fontSize: "13px", width: "100%" }}
          />
          <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: "14px" }}>
            🔍
          </span>
        </div>
      </div>

      {/* Sessions Table */}
      {filteredSessions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>📂</div>
          <p>No signing sessions found matching your filter criteria.</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                <th style={{ padding: "12px", fontSize: "12px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase" }}>Session Details</th>
                <th style={{ padding: "12px", fontSize: "12px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase" }}>Organization</th>
                <th style={{ padding: "12px", fontSize: "12px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase" }}>Templates in Order</th>
                <th style={{ padding: "12px", fontSize: "12px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase" }}>Public Link</th>
                <th style={{ padding: "12px", fontSize: "12px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.map((session) => (
                <tr key={session.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", transition: "background var(--transition-fast)" }}>
                  <td style={{ padding: "16px 12px" }}>
                    <div style={{ fontWeight: "600", fontSize: "14px", color: "var(--text-main)" }}>{session.title}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                      Created: {new Date(session.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td style={{ padding: "16px 12px", fontSize: "13px" }}>
                    <span style={{ background: "rgba(255, 255, 255, 0.05)", padding: "4px 8px", borderRadius: "4px", fontSize: "12px" }}>
                      {session.organization.name}
                    </span>
                  </td>
                  <td style={{ padding: "16px 12px", maxWidth: "280px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {session.templateTitles.map((title, idx) => (
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
                      onClick={() => handleCopyLink(session.slug, session.id)}
                      className="btn btn-secondary"
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        width: "auto",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        background: copiedId === session.id ? "rgba(16, 185, 129, 0.15)" : "transparent",
                        borderColor: copiedId === session.id ? "#10b981" : "var(--border-color)",
                        color: copiedId === session.id ? "#34d399" : "var(--text-muted)"
                      }}
                    >
                      {copiedId === session.id ? "✅ Copied" : "📋 Copy Link"}
                    </button>
                  </td>
                  <td style={{ padding: "16px 12px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                      <Link
                        href={`/admin/sessions/${session.id}/edit`}
                        className="btn btn-secondary"
                        style={{ padding: "6px 12px", fontSize: "12px", width: "auto" }}
                      >
                        ✏️ Edit
                      </Link>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleToggleArchive(session)}
                        style={{ padding: "6px 12px", fontSize: "12px", width: "auto" }}
                      >
                        {session.isArchived ? "🔓 Restore" : "🗄️ Archive"}
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => handleDeleteSession(session.id)}
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
    </div>
  );
}
