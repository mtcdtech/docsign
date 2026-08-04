"use client";

import React, { useState } from "react";

interface AuditLog {
  id: string;
  email: string;
  action: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AuditLogsDashboardClientProps {
  initialAuditLogs: AuditLog[];
}

export default function AuditLogsDashboardClient({ initialAuditLogs }: AuditLogsDashboardClientProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "logins" | "edits" | "deletions" | "emails">("all");

  const filteredLogs = initialAuditLogs.filter((log) => {
    // 1. Filter by search term (email / action)
    const matchesSearch = 
      log.email.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;

    // 2. Filter by button type
    if (filterType === "all") return true;
    if (filterType === "logins") {
      return log.action.includes("Login");
    }
    if (filterType === "edits") {
      return log.action.includes("Created Template") || log.action.includes("Saved template");
    }
    if (filterType === "deletions") {
      return log.action.toLowerCase().includes("delete");
    }
    if (filterType === "emails") {
      return log.action.toLowerCase().includes("email") || log.action.toLowerCase().includes("mail");
    }
    return true;
  });

  return (
    <div className="card-glass" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: isCollapsed ? "0px" : "20px" }}>
      <div 
        style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          cursor: "pointer",
          userSelect: "none"
        }}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div>
          <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
            <span>System Audit Log</span>
            <span style={{ 
              fontSize: "11px", 
              padding: "2px 8px", 
              borderRadius: "12px", 
              background: "rgba(255, 255, 255, 0.08)", 
              color: "var(--text-muted)",
              fontWeight: "normal"
            }}>
              {isCollapsed ? "▼ Show Log" : "▲ Hide Log"}
            </span>
          </h2>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
            Real-time track of user logins, template edits, and system configuration modifications.
          </p>
        </div>
      </div>

      {!isCollapsed && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", borderTop: "1px solid var(--border-color)", paddingTop: "20px" }}>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {(["all", "logins", "edits", "deletions", "emails"] as const).map((type) => {
                const isActive = filterType === type;
                const labels = {
                  all: "All Events",
                  logins: "🔐 Logins",
                  edits: "✏️ Creations & Edits",
                  deletions: "🗑 Deletions",
                  emails: "📧 Emails"
                };

                return (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    type="button"
                    className="btn"
                    style={{
                      width: "auto",
                      padding: "6px 16px",
                      fontSize: "12px",
                      borderRadius: "20px",
                      background: isActive ? "var(--primary-color)" : "rgba(255, 255, 255, 0.05)",
                      color: isActive ? "#ffffff" : "var(--text-muted)",
                      border: "1px solid " + (isActive ? "var(--primary-color)" : "var(--border-color)"),
                      cursor: "pointer",
                      fontWeight: isActive ? "600" : "400",
                      transition: "all var(--transition-fast)",
                    }}
                  >
                    {labels[type]}
                  </button>
                );
              })}
            </div>

            <input
              type="text"
              className="form-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search logs by email or action..."
              style={{ width: "300px", padding: "8px 12px", fontSize: "13px" }}
            />
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto", background: "rgba(0,0,0,0.15)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)", background: "rgba(255,255,255,0.02)" }}>
                  <th style={{ padding: "12px 16px" }}>User Email</th>
                  <th style={{ padding: "12px 16px" }}>Action / Event Description</th>
                  <th style={{ padding: "12px 16px" }}>IP / User Agent</th>
                  <th style={{ padding: "12px 16px" }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontStyle: "italic" }}>
                      No matching audit logs found.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const isLogin = log.action.includes("Login");
                    const isDelete = log.action.toLowerCase().includes("delete");
                    const isEmail = log.action.toLowerCase().includes("email") || log.action.toLowerCase().includes("mail");

                    let bg = "rgba(245, 158, 11, 0.18)";
                    let fg = "#fbbf24";
                    
                    if (isLogin) {
                      bg = log.action === "SSO Login" ? "rgba(34, 197, 94, 0.18)" : "rgba(79, 70, 229, 0.18)";
                      fg = log.action === "SSO Login" ? "#4ade80" : "#a5b4fc";
                    } else if (isDelete) {
                      bg = "rgba(239, 68, 68, 0.18)";
                      fg = "#f87171";
                    } else if (isEmail) {
                      bg = "rgba(6, 182, 212, 0.18)";
                      fg = "#22d3ee";
                    }

                    return (
                      <tr
                        key={log.id}
                        style={{
                          borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
                          transition: "background var(--transition-fast)",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.01)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: "600" }}>
                          {log.email}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span
                            style={{
                              fontSize: "12px",
                              padding: "4px 10px",
                              borderRadius: "4px",
                              fontWeight: "500",
                              background: bg,
                              color: fg,
                            }}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: "12px" }}>
                          <div style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: "200px" }} title={`${log.ip || "Unknown IP"} • ${log.userAgent || "Unknown UA"}`}>
                            {log.ip || "—"} <span style={{ opacity: 0.5 }}>•</span> {log.userAgent || "—"}
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px", color: "var(--text-muted)" }} suppressHydrationWarning>
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
