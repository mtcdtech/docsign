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

interface RegistrationDashboardProps {
  registration: {
    id: string;
    title: string;
    slug: string;
    organizationName: string;
    pcoSignupId: string | null;
  };
  templates: {
    id: string;
    title: string;
    pcoQuestionTitle: string | null;
  }[];
}

export default function RegistrationDashboardClient({ registration, templates }: RegistrationDashboardProps) {
  const router = useRouter();
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "completed" | "partial" | "not_started">("all");
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  const fetchAttendees = async () => {
    if (!registration.pcoSignupId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/registrations/${registration.id}/pco`);
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "Failed to load attendees list.");
      }
      setAttendees(data.attendees || []);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendees();
  }, [registration.id]);

  const handleSyncAttendee = async (att: Attendee) => {
    setSyncingId(att.id);
    setSyncSuccessMsg(null);
    try {
      const res = await fetch(`/api/admin/registrations/${registration.id}/pco`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: att.email, name: att.name })
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "Failed to sync attendee.");
      }
      setSyncSuccessMsg(`Successfully synced check-offs for ${att.name}!`);
      setTimeout(() => setSyncSuccessMsg(null), 3000);
      // Reload attendees list
      fetchAttendees();
    } catch (err: any) {
      alert(err.message || "Failed to complete PCO check-off sync.");
    } finally {
      setSyncingId(null);
    }
  };

  // Filter attendees
  const filteredAttendees = attendees.filter((att) => {
    const matchesSearch =
      att.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      att.email.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterTab === "completed") return att.status === "Completed";
    if (filterTab === "partial") return att.status.startsWith("Partial");
    if (filterTab === "not_started") return att.status === "Not Started";
    return true;
  });

  // Calculate metrics
  const totalCount = attendees.length;
  const completedCount = attendees.filter((a) => a.status === "Completed").length;
  const partialCount = attendees.filter((a) => a.status.startsWith("Partial")).length;
  const notStartedCount = attendees.filter((a) => a.status === "Not Started").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header breadcrumb & info */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text-muted)", marginBottom: "8px" }}>
            <Link href="/admin/registrations" style={{ color: "var(--text-muted)", textDecoration: "none" }}>Registrations</Link>
            <span>&gt;</span>
            <span style={{ color: "var(--text-main)" }}>Dashboard</span>
          </div>
          <h1>{registration.title}</h1>
          <p style={{ marginTop: "4px" }}>
            Organization: <strong style={{ color: "var(--text-main)" }}>{registration.organizationName}</strong> | 
            Public Link Slug: <strong style={{ color: "var(--text-main)" }}>{registration.slug}</strong>
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={fetchAttendees} className="btn btn-secondary" style={{ width: "auto", display: "flex", alignItems: "center", gap: "8px" }} disabled={loading}>
            🔄 Reload List
          </button>
          <Link href={`/admin/registrations/${registration.id}/edit`} className="btn" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", width: "auto" }}>
            ✏️ Edit Registration
          </Link>
        </div>
      </div>

      {!registration.pcoSignupId ? (
        <div className="card-glass" style={{ padding: "32px", textAlign: "center" }}>
          <div style={{ fontSize: "36px", marginBottom: "16px" }}>🔌</div>
          <h2>Planning Center Integration Not Connected</h2>
          <p style={{ color: "var(--text-muted)", maxWidth: "540px", margin: "8px auto 20px auto" }}>
            This signing packet is not currently connected to a Planning Center Online signup registration. Edit this registration to add a Signup ID to sync attendees.
          </p>
          <Link href={`/admin/registrations/${registration.id}/edit`} className="btn btn-primary" style={{ width: "auto" }}>
            Connect Planning Center Signup
          </Link>
        </div>
      ) : (
        <>
          {/* Status Metrics Cards */}
          <div className="dashboard-grid">
            <div className="card-glass" style={{ padding: "20px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "600" }}>Total PCO Registrants</span>
              <div style={{ fontSize: "32px", fontWeight: "bold", marginTop: "8px" }}>{loading ? "..." : totalCount}</div>
            </div>
            <div className="card-glass" style={{ padding: "20px", borderLeft: "4px solid #10b981" }}>
              <span style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "600" }}>Completed Packets</span>
              <div style={{ fontSize: "32px", fontWeight: "bold", marginTop: "8px", color: "#34d399" }}>{loading ? "..." : completedCount}</div>
            </div>
            <div className="card-glass" style={{ padding: "20px", borderLeft: "4px solid #facc15" }}>
              <span style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "600" }}>Partial Signatures</span>
              <div style={{ fontSize: "32px", fontWeight: "bold", marginTop: "8px", color: "#fde047" }}>{loading ? "..." : partialCount}</div>
            </div>
            <div className="card-glass" style={{ padding: "20px", borderLeft: "4px solid var(--text-muted)" }}>
              <span style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "600" }}>Not Started</span>
              <div style={{ fontSize: "32px", fontWeight: "bold", marginTop: "8px", color: "var(--text-muted)" }}>{loading ? "..." : notStartedCount}</div>
            </div>
          </div>

          {syncSuccessMsg && (
            <div style={{ color: "#22c55e", fontSize: "14px", fontWeight: "bold", background: "rgba(34, 197, 94, 0.1)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(34, 197, 94, 0.2)" }}>
              ✓ {syncSuccessMsg}
            </div>
          )}

          {error && (
            <div style={{ padding: "12px 16px", borderRadius: "8px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid #ef4444", color: "#f87171", fontSize: "13.5px" }}>
              ⚠️ {error}
            </div>
          )}

          {/* Attendees Table Wrapper */}
          <div className="card-glass" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
              {/* Tabs */}
              <div style={{ display: "flex", gap: "6px", background: "rgba(255,255,255,0.02)", padding: "4px", borderRadius: "6px", border: "1px solid var(--border-color)" }}>
                <button type="button" className="btn" onClick={() => setFilterTab("all")} style={{ padding: "6px 14px", fontSize: "12px", width: "auto", background: filterTab === "all" ? "var(--primary-color)" : "transparent", color: filterTab === "all" ? "#ffffff" : "var(--text-muted)" }}>
                  All ({totalCount})
                </button>
                <button type="button" className="btn" onClick={() => setFilterTab("completed")} style={{ padding: "6px 14px", fontSize: "12px", width: "auto", background: filterTab === "completed" ? "var(--primary-color)" : "transparent", color: filterTab === "completed" ? "#ffffff" : "var(--text-muted)" }}>
                  Completed ({completedCount})
                </button>
                <button type="button" className="btn" onClick={() => setFilterTab("partial")} style={{ padding: "6px 14px", fontSize: "12px", width: "auto", background: filterTab === "partial" ? "var(--primary-color)" : "transparent", color: filterTab === "partial" ? "#ffffff" : "var(--text-muted)" }}>
                  Partial ({partialCount})
                </button>
                <button type="button" className="btn" onClick={() => setFilterTab("not_started")} style={{ padding: "6px 14px", fontSize: "12px", width: "auto", background: filterTab === "not_started" ? "var(--primary-color)" : "transparent", color: filterTab === "not_started" ? "#ffffff" : "var(--text-muted)" }}>
                  Not Started ({notStartedCount})
                </button>
              </div>

              {/* Search input */}
              <div style={{ position: "relative", minWidth: "240px" }}>
                <input
                  type="text"
                  className="form-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search attendee by name/email..."
                  style={{ padding: "6px 10px 6px 30px", fontSize: "13px", width: "100%" }}
                />
                <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: "12px" }}>🔍</span>
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                <div className="spinner" style={{ border: "2px solid rgba(255,255,255,0.1)", borderTop: "2px solid var(--primary-color)", borderRadius: "50%", width: "24px", height: "24px", animation: "spin 1s linear infinite", margin: "0 auto 12px auto" }} />
                <span>Loading Planning Center registrants directory...</span>
              </div>
            ) : filteredAttendees.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                No registrants match your search query and filters.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-color)", background: "rgba(255,255,255,0.01)" }}>
                      <th style={{ padding: "12px", fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase" }}>Name & Email</th>
                      <th style={{ padding: "12px", fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase" }}>Waiver Packet Checklist</th>
                      <th style={{ padding: "12px", fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase" }}>Status</th>
                      <th style={{ padding: "12px", fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", textAlign: "right" }}>PCO Sync</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttendees.map((att) => (
                      <tr key={att.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                        <td style={{ padding: "14px 12px" }}>
                          <div style={{ fontWeight: "600", fontSize: "13.5px", color: "var(--text-main)" }}>{att.name}</div>
                          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{att.email}</div>
                        </td>
                        <td style={{ padding: "14px 12px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {att.checklist.map((item) => (
                              <div key={item.templateId} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
                                <span style={{ color: item.signed ? "#10b981" : "#ef4444", fontWeight: "bold" }}>
                                  {item.signed ? "✓" : "✗"}
                                </span>
                                <span style={{ color: item.signed ? "var(--text-main)" : "var(--text-muted)" }}>
                                  {item.title}
                                </span>
                                {item.pcoQuestionTitle && (
                                  <span style={{ fontSize: "10px", background: item.pcoAnswered ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)", color: item.pcoAnswered ? "#34d399" : "#f87171", padding: "1px 4px", borderRadius: "3px" }}>
                                    PCO: {item.pcoAnswered ? "Checked" : "Unchecked"}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: "14px 12px" }}>
                          <span style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: "bold",
                            background: att.status === "Completed" ? "rgba(16,185,129,0.12)" : att.status.startsWith("Partial") ? "rgba(250,204,21,0.12)" : "rgba(255,255,255,0.04)",
                            color: att.status === "Completed" ? "#34d399" : att.status.startsWith("Partial") ? "#fde047" : "var(--text-muted)"
                          }}>
                            {att.status}
                          </span>
                        </td>
                        <td style={{ padding: "14px 12px", textAlign: "right" }}>
                          <button
                            type="button"
                            onClick={() => handleSyncAttendee(att)}
                            className="btn btn-secondary"
                            disabled={syncingId !== null || att.checklist.every((c) => !c.signed)}
                            style={{
                              padding: "4px 10px",
                              fontSize: "12px",
                              width: "auto",
                              background: syncingId === att.id ? "rgba(255,255,255,0.02)" : "transparent",
                              cursor: att.checklist.every((c) => !c.signed) ? "not-allowed" : "pointer"
                            }}
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
        </>
      )}

      <style jsx>{`
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
