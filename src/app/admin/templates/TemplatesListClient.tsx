"use client";

import React, { useState } from "react";
import Link from "next/link";

interface OrgUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface Organization {
  id: string;
  name: string;
  users?: OrgUser[];
}

interface Template {
  id: string;
  title: string;
  slug: string;
  pdfPath: string;
  fieldsJson: string;
  emailUser: boolean;
  emailLeader: boolean;
  notificationEmails: string | null;
  saveSharepoint: boolean;
  sharepointFolderId: string | null;
  sharepointFolderName: string | null;
  organizationId: string;
  createdAt: any;
  organization: Organization;
}

interface Submission {
  id: string;
  signerName: string;
  signerEmail: string;
  formDataJson: string;
  signedPdfPath: string;
  createdAt: string;
  sharepointUrl: string | null;
}

interface TemplatesListClientProps {
  templates: Template[];
}

export default function TemplatesListClient({ templates: initialTemplates }: TemplatesListClientProps) {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [searchQuery, setSearchQuery] = useState("");
  const [orgSortOrder, setOrgSortOrder] = useState<"asc" | "desc" | null>(null);

  // History Expandable States
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [submissionSearch, setSubmissionSearch] = useState("");
  const [submissionSortBy, setSubmissionSortBy] = useState<"signerName" | "createdAt">("createdAt");
  const [submissionSortOrder, setSubmissionSortOrder] = useState<"asc" | "desc">("desc");
  const [confirmClearTemplateId, setConfirmClearTemplateId] = useState<string | null>(null);
  const [confirmDeleteSubmissionId, setConfirmDeleteSubmissionId] = useState<string | null>(null);

  // Handle template organization sorting
  const handleSortByOrganization = () => {
    const nextOrder = orgSortOrder === "asc" ? "desc" : "asc";
    setOrgSortOrder(nextOrder);

    const sorted = [...templates].sort((a, b) => {
      const orgA = a.organization.name.toLowerCase();
      const orgB = b.organization.name.toLowerCase();
      if (nextOrder === "asc") {
        return orgA.localeCompare(orgB);
      } else {
        return orgB.localeCompare(orgA);
      }
    });
    setTemplates(sorted);
  };

  // Toggle collapsible history row and fetch submissions
  const handleToggleHistory = async (template: Template) => {
    if (activeTemplate?.id === template.id) {
      setActiveTemplate(null);
      setSubmissions([]);
      return;
    }
    setActiveTemplate(template);
    setLoadingSubmissions(true);
    setSubmissionSearch("");
    try {
      const res = await fetch(`/api/admin/submissions?templateId=${template.id}`);
      const data = await res.json();
      if (res.ok && data.ok) {
        setSubmissions(data.submissions || []);
      } else {
        console.error("Failed to load template submissions:", data.error);
      }
    } catch (e) {
      console.error("Error loading submissions:", e);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  // Delete individual submission
  const handleDeleteSubmission = async (submissionId: string, templateId: string) => {
    try {
      const res = await fetch(`/api/admin/submissions?templateId=${templateId}&submissionId=${submissionId}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
        setConfirmDeleteSubmissionId(null);
      } else {
        alert(data.error || "Failed to delete submission.");
      }
    } catch (e) {
      console.error(e);
      alert("An unexpected error occurred while deleting the submission.");
    }
  };

  // Clear all submissions for a template
  const handleClearAllSubmissions = async (templateId: string) => {
    try {
      const res = await fetch(`/api/admin/submissions?templateId=${templateId}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSubmissions([]);
        setConfirmClearTemplateId(null);
      } else {
        alert(data.error || "Failed to clear submissions.");
      }
    } catch (e) {
      console.error(e);
      alert("An unexpected error occurred while clearing submissions.");
    }
  };

  // Filter templates list
  const filteredTemplates = templates.filter((t) =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.organization.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter & sort submissions list
  const filteredSubmissions = submissions
    .filter((s) =>
      s.signerName.toLowerCase().includes(submissionSearch.toLowerCase()) ||
      s.signerEmail.toLowerCase().includes(submissionSearch.toLowerCase())
    )
    .sort((a, b) => {
      if (submissionSortBy === "signerName") {
        return submissionSortOrder === "asc"
          ? a.signerName.localeCompare(b.signerName)
          : b.signerName.localeCompare(a.signerName);
      } else {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return submissionSortOrder === "asc" ? dateA - dateB : dateB - dateA;
      }
    });

  const getFilename = (filepath: string) => {
    return filepath.split(/[/\\]/).pop() || "";
  };

  return (
    <div>
      {/* Top Header controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div style={{ display: "flex", gap: "12px", flex: 1, minWidth: "280px" }}>
          <input
            type="text"
            className="form-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates or organizations..."
            style={{ width: "100%", maxWidth: "360px", padding: "10px 14px", fontSize: "14px" }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleSortByOrganization}
            style={{ padding: "10px 16px", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}
          >
            Sort Org {orgSortOrder === "asc" ? "▲" : orgSortOrder === "desc" ? "▼" : "↕"}
          </button>
        </div>

        <Link href="/admin/templates/new" className="btn btn-primary" style={{ width: "auto" }}>
          Create New Template
        </Link>
      </div>

      {/* Main templates list table */}
      <div className="card-glass" style={{ padding: "0px", overflow: "hidden" }}>
        <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
          {filteredTemplates.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
              No templates found.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Template Name</th>
                  <th style={{ cursor: "pointer" }} onClick={handleSortByOrganization}>
                    Organization {orgSortOrder === "asc" ? "▲" : orgSortOrder === "desc" ? "▼" : "↕"}
                  </th>
                  <th>Public Slug Link</th>
                  <th>SharePoint</th>
                  <th>Email Settings</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTemplates.map((tpl) => {
                  const publicUrl = `/sign/${tpl.slug}`;
                  const isExpanded = activeTemplate?.id === tpl.id;
                  return (
                    <React.Fragment key={tpl.id}>
                      <tr style={{ background: isExpanded ? "rgba(255, 255, 255, 0.03)" : "none" }}>
                        <td style={{ fontWeight: 600, color: "var(--text-main)" }}>{tpl.title}</td>
                        <td>{tpl.organization.name}</td>
                        <td>
                          <a href={publicUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary-color)", textDecoration: "none" }}>
                            /{tpl.slug}
                          </a>
                        </td>
                        <td>
                          {tpl.saveSharepoint ? (
                            <span
                              title={`Folder: ${tpl.sharepointFolderName || "Root"}\nPath ID: ${tpl.sharepointFolderId || "N/A"}`}
                              style={{ color: "#22c55e", fontSize: "12px", background: "rgba(34, 197, 94, 0.1)", padding: "4px 8px", borderRadius: "4px", cursor: "help" }}
                            >
                              Enabled
                            </span>
                          ) : (
                            <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>Disabled</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                            {tpl.emailUser && (
                              <span
                                title={`Signer Copy: Enabled\nLeader Copy: ${tpl.emailLeader ? "Enabled" : "Disabled"}${tpl.notificationEmails ? `\nRecipients: ${tpl.notificationEmails}` : ""}`}
                                style={{ color: "var(--primary-color)", fontSize: "11px", background: "rgba(79, 70, 229, 0.1)", padding: "4px 8px", borderRadius: "4px", cursor: "help", fontWeight: "bold" }}
                              >
                                Signer
                              </span>
                            )}
                            {tpl.emailLeader && (
                              <span
                                title={`Signer Copy: ${tpl.emailUser ? "Enabled" : "Disabled"}\nLeader Copy: Enabled${tpl.notificationEmails ? `\nRecipients: ${tpl.notificationEmails}` : ""}`}
                                style={{ color: "#f59e0b", fontSize: "11px", background: "rgba(245, 158, 11, 0.1)", padding: "4px 8px", borderRadius: "4px", cursor: "help", fontWeight: "bold" }}
                              >
                                Leaders
                              </span>
                            )}
                            {!tpl.emailUser && !tpl.emailLeader && (
                              <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>Disabled</span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => handleToggleHistory(tpl)}
                              style={{ padding: "6px 12px", fontSize: "12px", width: "auto", display: "flex", alignItems: "center", gap: "4px" }}
                            >
                              {isExpanded ? "▲ Hide Log" : "📜 History"}
                            </button>
                            <Link href={`/admin/templates/${tpl.id}/design`} className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "12px", width: "auto" }}>
                              Designer
                            </Link>
                            <Link href={`/admin/templates/${tpl.id}/edit`} className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "12px", width: "auto" }}>
                              Settings
                            </Link>
                          </div>
                        </td>
                      </tr>

                      {/* Collapsible history subtable drawer */}
                      {isExpanded && (
                        <tr style={{ background: "rgba(0, 0, 0, 0.12)" }}>
                          <td colSpan={6} style={{ padding: "20px", borderTop: "none" }}>
                            <div className="card-glass" style={{ background: "rgba(0,0,0,0.25)", padding: "16px", display: "flex", flexDirection: "column", gap: "12px", border: "1px solid rgba(255,255,255,0.05)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "8px" }}>
                                <span style={{ fontSize: "11px", color: "var(--primary-color)", fontWeight: "bold", textTransform: "uppercase" }}>
                                  Historic Submissions Log ({submissions.length} Total)
                                </span>
                                <div style={{ display: "flex", gap: "8px" }}>
                                  {submissions.length > 0 && (
                                    confirmClearTemplateId === tpl.id ? (
                                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                        <span style={{ fontSize: "11px", color: "#ef4444", fontWeight: "bold" }}>Confirm clear all?</span>
                                        <button
                                          type="button"
                                          className="btn btn-primary"
                                          onClick={() => handleClearAllSubmissions(tpl.id)}
                                          style={{ padding: "4px 8px", fontSize: "11px", width: "auto", background: "#ef4444", borderColor: "#ef4444" }}
                                        >
                                          Yes, Clear
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-secondary"
                                          onClick={() => setConfirmClearTemplateId(null)}
                                          style={{ padding: "4px 8px", fontSize: "11px", width: "auto" }}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => setConfirmClearTemplateId(tpl.id)}
                                        style={{ padding: "4px 8px", fontSize: "11px", width: "auto", background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.2)" }}
                                      >
                                        🗑️ Clear All
                                      </button>
                                    )
                                  )}
                                  <button
                                    className="btn btn-secondary"
                                    onClick={() => setActiveTemplate(null)}
                                    style={{ padding: "4px 8px", fontSize: "11px", width: "auto" }}
                                  >
                                    ✕ Close
                                  </button>
                                </div>
                              </div>

                              <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                                <input
                                  type="text"
                                  className="form-input"
                                  value={submissionSearch}
                                  onChange={(e) => setSubmissionSearch(e.target.value)}
                                  placeholder="Search by Signer Name or Email..."
                                  style={{ flex: 1, minWidth: "220px", padding: "8px 12px", fontSize: "13px" }}
                                />
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  onClick={() => {
                                    setSubmissionSortBy("signerName");
                                    setSubmissionSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
                                  }}
                                  style={{ padding: "8px 14px", fontSize: "12px", width: "auto" }}
                                >
                                  Sort Name {submissionSortBy === "signerName" ? (submissionSortOrder === "asc" ? "▲" : "▼") : ""}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  onClick={() => {
                                    setSubmissionSortBy("createdAt");
                                    setSubmissionSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
                                  }}
                                  style={{ padding: "8px 14px", fontSize: "12px", width: "auto" }}
                                >
                                  Sort Date {submissionSortBy === "createdAt" ? (submissionSortOrder === "asc" ? "▲" : "▼") : ""}
                                </button>
                              </div>

                              <div style={{ overflowX: "auto" }}>
                                {loadingSubmissions ? (
                                  <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                                    Retrieving signature logs...
                                  </div>
                                ) : filteredSubmissions.length === 0 ? (
                                  <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                                    No submission logs found.
                                  </div>
                                ) : (
                                  <div className="table-container" style={{ margin: 0, border: "1px solid rgba(255,255,255,0.05)", borderRadius: "6px" }}>
                                    <table style={{ width: "100%" }}>
                                      <thead>
                                        <tr>
                                          <th>Date Signed</th>
                                          <th>Signer Name</th>
                                          <th>Signer Email</th>
                                          <th>Fields Payload</th>
                                          <th style={{ textAlign: "right" }}>Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {filteredSubmissions.map((doc) => {
                                          const date = new Date(doc.createdAt).toLocaleString();
                                          const formData = JSON.parse(doc.formDataJson);
                                          return (
                                            <tr key={doc.id}>
                                              <td style={{ fontSize: "12px" }} suppressHydrationWarning>{date}</td>
                                              <td style={{ fontWeight: 600 }}>{doc.signerName}</td>
                                              <td style={{ fontSize: "12px" }}>{doc.signerEmail}</td>
                                              <td>
                                                <details style={{ cursor: "pointer" }}>
                                                  <summary style={{ fontSize: "11px", color: "var(--primary-color)" }}>View Mapped Fields ({Object.keys(formData).length})</summary>
                                                  <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "4px", fontSize: "11px", marginTop: "4px", maxHeight: "150px", overflowY: "auto", fontFamily: "monospace" }}>
                                                    {Object.entries(formData).map(([k, v]) => (
                                                      <div key={k} style={{ marginBottom: "2px" }}>
                                                        <span style={{ color: "var(--text-muted)" }}>{k}:</span> {String(v)}
                                                      </div>
                                                    ))}
                                                  </div>
                                                </details>
                                              </td>
                                              <td style={{ textAlign: "right" }}>
                                                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                                                  <a
                                                    href={`/api/download/signed/${getFilename(doc.signedPdfPath)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btn btn-secondary"
                                                    style={{ padding: "4px 8px", fontSize: "11px", width: "auto" }}
                                                  >
                                                    View PDF
                                                  </a>
                                                  {confirmDeleteSubmissionId === doc.id ? (
                                                     <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                                       <span style={{ fontSize: "11px", color: "#ef4444", fontWeight: "bold" }}>Delete?</span>
                                                       <button
                                                         type="button"
                                                         className="btn btn-primary"
                                                         onClick={() => handleDeleteSubmission(doc.id, tpl.id)}
                                                         style={{ padding: "4px 8px", fontSize: "11px", width: "auto", background: "#ef4444", borderColor: "#ef4444" }}
                                                       >
                                                         Yes
                                                       </button>
                                                       <button
                                                         type="button"
                                                         className="btn btn-secondary"
                                                         onClick={() => setConfirmDeleteSubmissionId(null)}
                                                         style={{ padding: "4px 8px", fontSize: "11px", width: "auto" }}
                                                       >
                                                         No
                                                       </button>
                                                     </div>
                                                   ) : (
                                                     <button
                                                       type="button"
                                                       onClick={() => setConfirmDeleteSubmissionId(doc.id)}
                                                       className="btn btn-secondary"
                                                       style={{ padding: "4px 8px", fontSize: "11px", width: "auto", background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.2)" }}
                                                     >
                                                       🗑️ Delete
                                                     </button>
                                                   )}
                                                </div>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
