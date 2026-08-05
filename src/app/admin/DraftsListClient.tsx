"use client";

import React, { useState, useEffect } from "react";
import FormPreviewModal from "@/components/FormPreviewModal";

interface Org {
  name: string;
}

interface Tpl {
  id: string;
  title: string;
  slug: string;
  pdfPath: string;
  fieldsJson: string;
  saveSharepoint: boolean;
  emailParent: boolean;
  organization: Org;
}

interface DraftDoc {
  id: string;
  signerName: string;
  signerEmail: string;
  formDataJson: string;
  createdAt: string;
  isDraft: boolean;
  template: Tpl;
}

interface DraftsListClientProps {
  draftDocs: DraftDoc[];
  portalTimezone?: string;
}

export default function DraftsListClient({ draftDocs: initialDraftDocs, portalTimezone = "America/Chicago" }: DraftsListClientProps) {
  const [drafts, setDrafts] = useState<DraftDoc[]>(initialDraftDocs);
  const [now, setNow] = useState<number>(Date.now());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewDraft, setPreviewDraft] = useState<DraftDoc | null>(null);

  // Update 'now' every second for real-time live countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleDeleteDraft = async (draft: DraftDoc) => {
    if (!confirm(`Are you sure you want to delete the draft for "${draft.template.title}"?`)) {
      return;
    }
    setDeletingId(draft.id);
    try {
      const res = await fetch(`/api/sign/${draft.template.id}/draft?draftId=${draft.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
      } else {
        alert("Failed to delete draft.");
      }
    } catch (e) {
      console.error(e);
      alert("Error deleting draft.");
    } finally {
      setDeletingId(null);
    }
  };

  const formatCountdown = (createdAtStr: string) => {
    const createdAtMs = new Date(createdAtStr).getTime();
    const expiresAtMs = createdAtMs + 24 * 60 * 60 * 1000;
    const diffMs = expiresAtMs - now;

    if (diffMs <= 0) {
      return {
        text: "Expired (Pending Auto-Delete)",
        badgeStyle: {
          background: "rgba(239, 68, 68, 0.2)",
          color: "#ef4444",
          border: "1px solid rgba(239, 68, 68, 0.4)",
        },
      };
    }

    const totalSecs = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    const timeString = `${hours.toString().padStart(2, "0")}h ${mins.toString().padStart(2, "0")}m ${secs.toString().padStart(2, "0")}s`;

    if (hours < 2) {
      return {
        text: `🚨 ${timeString} remaining`,
        badgeStyle: {
          background: "rgba(239, 68, 68, 0.2)",
          color: "#f87171",
          border: "1px solid rgba(239, 68, 68, 0.4)",
        },
      };
    }

    if (hours < 6) {
      return {
        text: `⚠️ ${timeString} remaining`,
        badgeStyle: {
          background: "rgba(245, 158, 11, 0.2)",
          color: "#f59e0b",
          border: "1px solid rgba(245, 158, 11, 0.4)",
        },
      };
    }

    return {
      text: `⏳ ${timeString} remaining`,
      badgeStyle: {
        background: "rgba(16, 185, 129, 0.15)",
        color: "#10b981",
        border: "1px solid rgba(16, 185, 129, 0.3)",
      },
    };
  };

  return (
    <>
      <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
        {drafts.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
            No drafts currently in progress. All clear!
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Signer / Contact</th>
                <th>Template</th>
                <th>Organization</th>
                <th>Saved At</th>
                <th>Expiration Timer (24h Auto-Delete)</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((doc) => {
                let displaySignerName = doc.signerName;
                let displaySignerEmail = doc.signerEmail;

                if (displaySignerName === "Anonymous Draft" || !displaySignerName) {
                  try {
                    const formData = JSON.parse(doc.formDataJson);
                    const fields = JSON.parse(doc.template.fieldsJson) || [];
                    const nameField = fields.find((f: any) => f.type === "signer_name");
                    const emailField = fields.find((f: any) => f.type === "signer_email");
                    if (nameField && formData[nameField.id]) {
                      displaySignerName = formData[nameField.id];
                    }
                    if (emailField && formData[emailField.id]) {
                      displaySignerEmail = formData[emailField.id];
                    }
                  } catch (e) {}
                }

                if (!displaySignerName || displaySignerName === "Anonymous Draft") {
                  displaySignerName = "In-Progress Visitor";
                }

                const timerInfo = formatCountdown(doc.createdAt);
                const resumeUrl = `/sign/${doc.template.slug}?draftId=${doc.id}`;

                return (
                  <tr key={doc.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--text-main)" }}>
                        {displaySignerName}
                      </div>
                      {displaySignerEmail ? (
                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                          {displaySignerEmail}
                        </div>
                      ) : null}
                    </td>

                    <td>
                      <div style={{ fontWeight: 600, color: "var(--text-main)" }}>
                        {doc.template.title}
                      </div>
                    </td>

                    <td>
                      <span className="badge" style={{ background: "rgba(255,255,255,0.06)" }}>
                        {doc.template.organization.name}
                      </span>
                    </td>

                    <td>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {new Date(doc.createdAt).toLocaleString("en-US", {
                          timeZone: portalTimezone,
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true
                        })}
                      </div>
                    </td>

                    <td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "4px 10px",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: 700,
                          fontVariantNumeric: "tabular-nums",
                          letterSpacing: "0.2px",
                          ...timerInfo.badgeStyle
                        }}
                      >
                        {timerInfo.text}
                      </span>
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                        <a
                          href={resumeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary"
                          style={{ padding: "4px 10px", fontSize: "12px" }}
                          title="Open draft form link"
                        >
                          🔗 Link
                        </a>
                        <button
                          type="button"
                          onClick={() => setPreviewDraft(doc)}
                          className="btn btn-secondary"
                          style={{ padding: "4px 10px", fontSize: "12px" }}
                          title="Preview draft form values"
                        >
                          👁️ View
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDraft(doc)}
                          disabled={deletingId === doc.id}
                          className="btn btn-danger"
                          style={{ padding: "4px 10px", fontSize: "12px", background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.3)" }}
                          title="Delete draft now"
                        >
                          {deletingId === doc.id ? "Deleting..." : "🗑️ Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Form Preview Modal for Drafts */}
      {previewDraft && (
        <FormPreviewModal
          submission={{
            id: previewDraft.id,
            signerName: previewDraft.signerName,
            signerEmail: previewDraft.signerEmail,
            formDataJson: previewDraft.formDataJson,
            signedPdfPath: null,
            createdAt: previewDraft.createdAt,
            sharepointUrl: null,
            emailedUser: false,
            emailedLeader: false,
            emailedParent: false,
            isDraft: true,
            template: previewDraft.template
          }}
          template={previewDraft.template}
          onClose={() => setPreviewDraft(null)}
        />
      )}
    </>
  );
}
