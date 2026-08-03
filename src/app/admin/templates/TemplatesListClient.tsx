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
  emailParent: boolean;
  notificationEmails: string | null;
  saveSharepoint: boolean;
  sharepointFolderId: string | null;
  sharepointFolderName: string | null;
  organizationId: string;
  isArchived: boolean;
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
  isDraft?: boolean;
}

interface TemplatesListClientProps {
  templates: Template[];
}

export default function TemplatesListClient({ templates: initialTemplates }: TemplatesListClientProps) {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [searchQuery, setSearchQuery] = useState("");
  const [orgSortOrder, setOrgSortOrder] = useState<"asc" | "desc" | null>(null);
  const [currentTab, setCurrentTab] = useState<"active" | "archived">("active");
  const [previewDoc, setPreviewDoc] = useState<Submission | null>(null);

  const handleSharePointTagClick = async (folderId: string) => {
    try {
      const res = await fetch(`/api/admin/sharepoint/folder-link?folderId=${encodeURIComponent(folderId)}`);
      const data = await res.json();
      if (data.ok && data.webUrl) {
        window.open(data.webUrl, "_blank", "noopener,noreferrer");
      } else {
        alert(`Unable to open SharePoint folder: ${data.error || "Unknown error"}`);
      }
    } catch (e: any) {
      console.error("Error launching folder:", e);
      alert("Error fetching SharePoint folder details.");
    }
  };

  const handleToggleArchive = async (tpl: Template) => {
    try {
      const nextArchivedState = !tpl.isArchived;
      const res = await fetch(`/api/admin/templates/${tpl.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isArchived: nextArchivedState }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setTemplates((prev) =>
          prev.map((t) => (t.id === tpl.id ? { ...t, isArchived: nextArchivedState } : t))
        );
      } else {
        alert(`Failed to update template status: ${data.error || "Unknown error"}`);
      }
    } catch (e: any) {
      console.error("Error toggling template archive status:", e);
      alert("Error updating template archive status.");
    }
  };

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
  const filteredTemplates = templates.filter((t) => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.organization.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (currentTab === "active") {
      return matchesSearch && !t.isArchived;
    } else {
      return matchesSearch && t.isArchived;
    }
  });

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

      {/* Tabs navigation */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border-color)", marginBottom: "20px", gap: "8px" }}>
        <button
          type="button"
          onClick={() => setCurrentTab("active")}
          style={{
            background: "none",
            border: "none",
            borderBottom: currentTab === "active" ? "2px solid var(--primary-color)" : "none",
            color: currentTab === "active" ? "var(--primary-color)" : "var(--text-muted)",
            padding: "10px 16px",
            fontSize: "14px",
            fontWeight: "bold",
            cursor: "pointer",
            transition: "all var(--transition-fast)"
          }}
        >
          Active Templates ({templates.filter(t => !t.isArchived).length})
        </button>
        <button
          type="button"
          onClick={() => setCurrentTab("archived")}
          style={{
            background: "none",
            border: "none",
            borderBottom: currentTab === "archived" ? "2px solid var(--primary-color)" : "none",
            color: currentTab === "archived" ? "var(--primary-color)" : "var(--text-muted)",
            padding: "10px 16px",
            fontSize: "14px",
            fontWeight: "bold",
            cursor: "pointer",
            transition: "all var(--transition-fast)"
          }}
        >
          Archived Templates ({templates.filter(t => t.isArchived).length})
        </button>
      </div>

      {/* Main templates list table */}
      <div className="card-glass" style={{ padding: "0px", overflow: "hidden" }}>
        <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
          {filteredTemplates.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
              No templates found.
            </div>
          ) : (
            <table style={{ tableLayout: "auto", width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ width: "20%", whiteSpace: "nowrap" }}>Template Name</th>
                  <th style={{ width: "15%", whiteSpace: "nowrap", cursor: "pointer" }} onClick={handleSortByOrganization}>
                    Organization {orgSortOrder === "asc" ? "▲" : orgSortOrder === "desc" ? "▼" : "↕"}
                  </th>
                  <th style={{ width: "20%", whiteSpace: "nowrap" }}>Public Slug Link</th>
                  <th style={{ width: "10%", whiteSpace: "nowrap" }}>SharePoint</th>
                  <th style={{ width: "15%", whiteSpace: "nowrap" }}>Email Settings</th>
                  <th style={{ width: "20%", whiteSpace: "nowrap", textAlign: "right" }}>Actions</th>
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
                        <td style={{ whiteSpace: "nowrap" }}>{tpl.organization.name}</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {tpl.isArchived ? (
                            <span style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: "13px" }}>
                              Archived (Link Disabled)
                            </span>
                          ) : (
                            <a href={publicUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary-color)", textDecoration: "none" }}>
                              /{tpl.slug}
                            </a>
                          )}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {tpl.saveSharepoint ? (
                            <span
                              title={`Folder: ${tpl.sharepointFolderName || "Root"}\nClick to open in SharePoint`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (tpl.sharepointFolderId) handleSharePointTagClick(tpl.sharepointFolderId);
                              }}
                              style={{ color: "#22c55e", fontSize: "12px", background: "rgba(34, 197, 94, 0.1)", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
                            >
                              Enabled 🔗
                            </span>
                          ) : (
                            <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>Disabled</span>
                          )}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", gap: "6px" }}>
                            {tpl.emailUser && (
                              <span
                                title={`Signer Copy: Enabled\nParent Copy: ${tpl.emailParent ? "Enabled" : "Disabled"}\nLeader Copy: ${tpl.emailLeader ? "Enabled" : "Disabled"}${tpl.notificationEmails ? `\nRecipients: ${tpl.notificationEmails}` : ""}`}
                                style={{ color: "var(--primary-color)", fontSize: "11px", background: "rgba(79, 70, 229, 0.1)", padding: "4px 8px", borderRadius: "4px", cursor: "help", fontWeight: "bold" }}
                              >
                                Signer
                              </span>
                            )}
                            {tpl.emailParent && (
                              <span
                                title={`Signer Copy: ${tpl.emailUser ? "Enabled" : "Disabled"}\nParent Copy: Enabled\nLeader Copy: ${tpl.emailLeader ? "Enabled" : "Disabled"}${tpl.notificationEmails ? `\nRecipients: ${tpl.notificationEmails}` : ""}`}
                                style={{ color: "#10b981", fontSize: "11px", background: "rgba(16, 185, 129, 0.1)", padding: "4px 8px", borderRadius: "4px", cursor: "help", fontWeight: "bold" }}
                              >
                                Parent
                              </span>
                            )}
                            {tpl.emailLeader && (
                              <span
                                title={`Signer Copy: ${tpl.emailUser ? "Enabled" : "Disabled"}\nParent Copy: ${tpl.emailParent ? "Enabled" : "Disabled"}\nLeader Copy: Enabled${tpl.notificationEmails ? `\nRecipients: ${tpl.notificationEmails}` : ""}`}
                                style={{ color: "#f59e0b", fontSize: "11px", background: "rgba(245, 158, 11, 0.1)", padding: "4px 8px", borderRadius: "4px", cursor: "help", fontWeight: "bold" }}
                              >
                                Leaders
                              </span>
                            )}
                            {!tpl.emailUser && !tpl.emailParent && !tpl.emailLeader && (
                              <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>Disabled</span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
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
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => handleToggleArchive(tpl)}
                              style={{ padding: "6px 12px", fontSize: "12px", width: "auto", border: "1px dashed var(--border-color)" }}
                            >
                              {tpl.isArchived ? "📁 Restore" : "📁 Archive"}
                            </button>
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
                                          <th style={{ textAlign: "right" }}>Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {filteredSubmissions.map((doc) => {
                                          const date = new Date(doc.createdAt).toLocaleString();
                                          
                                          // Find the resolved name in case it is Anonymous Draft
                                          let displaySignerName = doc.signerName;
                                          if (displaySignerName === "Anonymous Draft" || !displaySignerName) {
                                            try {
                                              const formData = JSON.parse(doc.formDataJson);
                                              const fields = JSON.parse(tpl.fieldsJson) || [];
                                              const nameField = fields.find((f: any) => f.type === "signer_name");
                                              if (nameField && formData[nameField.id]) {
                                                displaySignerName = formData[nameField.id];
                                              }
                                            } catch (e) {}
                                          }

                                          return (
                                            <tr 
                                              key={doc.id} 
                                              onClick={() => setPreviewDoc(doc)}
                                              style={{ opacity: doc.isDraft ? 0.75 : 1, cursor: "pointer" }}
                                              title="Click row to preview submission details"
                                            >
                                              <td style={{ fontSize: "12px" }} suppressHydrationWarning>{date}</td>
                                              <td style={{ fontWeight: 600 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                  <span>{displaySignerName}</span>
                                                  {doc.isDraft && (
                                                    <span style={{ fontSize: "9px", padding: "1px 5px", borderRadius: "3px", background: "#f59e0b", color: "#fff", fontWeight: "bold" }}>
                                                      Draft
                                                    </span>
                                                  )}
                                                </div>
                                              </td>
                                              <td style={{ fontSize: "12px" }}>{doc.signerEmail || "(Unspecified)"}</td>
                                              <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                                                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", alignItems: "center" }}>
                                                  {doc.isDraft ? (
                                                    <span style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic", paddingRight: "6px" }}>
                                                      In Progress
                                                    </span>
                                                  ) : (
                                                    <a
                                                      href={doc.signedPdfPath ? `/api/download/signed/${getFilename(doc.signedPdfPath)}` : "#"}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="btn btn-secondary"
                                                      style={{ padding: "4px 8px", fontSize: "11px", width: "auto" }}
                                                    >
                                                      View PDF
                                                    </a>
                                                  )}
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

      {previewDoc && (() => {
        let formData = {};
        try {
          formData = JSON.parse(previewDoc.formDataJson);
        } catch (e) {}

        return (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)",
          }} onClick={() => setPreviewDoc(null)}>
            <div className="card-glass" style={{
              width: "550px",
              maxWidth: "90%",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)",
              border: "1px solid var(--border-color)",
            }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "bold" }}>Form Submission Preview</h3>
                <button 
                  onClick={() => setPreviewDoc(null)}
                  style={{ background: "transparent", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--text-muted)" }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "16px" }}>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Signer Name</span>
                  <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{previewDoc.signerName}</div>
                </div>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Signer Email</span>
                  <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{previewDoc.signerEmail || "(Not provided)"}</div>
                </div>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Date</span>
                  <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{new Date(previewDoc.createdAt).toLocaleString()}</div>
                </div>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Status</span>
                  <div>
                    {previewDoc.isDraft ? (
                      <span style={{ background: "#f59e0b", color: "#fff", padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold" }}>
                        Draft in Progress
                      </span>
                    ) : (
                      <span style={{ background: "#22c55e", color: "#fff", padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold" }}>
                        Completed Submission
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: "bold", color: "var(--text-main)" }}>Form Field Responses</h4>
                {Object.keys(formData).length === 0 ? (
                  <div style={{ fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic", padding: "12px", background: "rgba(0,0,0,0.15)", borderRadius: "6px", textAlign: "center" }}>
                    No responses entered yet.
                  </div>
                ) : (
                  <div style={{ background: "rgba(0,0,0,0.25)", padding: "12px", borderRadius: "6px", maxHeight: "250px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                    {Object.entries(formData).map(([key, val]) => (
                      <div key={key} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "6px", fontSize: "13px" }}>
                        <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{key}</span>
                        <span style={{ color: "var(--text-main)", fontWeight: 600, wordBreak: "break-word", maxWidth: "60%" }}>{String(val)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <button 
                  onClick={() => setPreviewDoc(null)} 
                  className="btn btn-secondary" 
                  style={{ width: "auto" }}
                >
                  Close
                </button>
                {!previewDoc.isDraft && previewDoc.signedPdfPath && (
                  <a
                    href={`/api/download/signed/${getFilename(previewDoc.signedPdfPath)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{ width: "auto", textDecoration: "none", textAlign: "center", lineHeight: "1.5" }}
                  >
                    View Signed PDF
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
