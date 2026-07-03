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

  // History Modal States
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [submissionSearch, setSubmissionSearch] = useState("");
  const [submissionSortBy, setSubmissionSortBy] = useState<"signerName" | "createdAt">("createdAt");
  const [submissionSortOrder, setSubmissionSortOrder] = useState<"asc" | "desc">("desc");

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

  // Fetch submissions from API
  const handleOpenHistory = async (template: Template) => {
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
                  <th>SharePoint Settings</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTemplates.map((tpl) => {
                  const publicUrl = `/sign/${tpl.slug}`;
                  return (
                    <tr key={tpl.id}>
                      <td style={{ fontWeight: 600, color: "var(--text-main)" }}>{tpl.title}</td>
                      <td>{tpl.organization.name}</td>
                      <td>
                        <a href={publicUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary-color)", textDecoration: "none" }}>
                          /{tpl.slug}
                        </a>
                      </td>
                      <td>
                        {tpl.saveSharepoint ? (
                          <span style={{ color: "#22c55e", fontSize: "12px", background: "rgba(34, 197, 94, 0.1)", padding: "4px 8px", borderRadius: "4px" }}>
                            Enabled ({tpl.sharepointFolderName || "Root"})
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>Disabled</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleOpenHistory(tpl)}
                            style={{ padding: "6px 12px", fontSize: "12px", width: "auto" }}
                          >
                            📜 History
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
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Template History Modal Popup Overlay */}
      {activeTemplate && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px" }}>
          <div className="card-glass" style={{ width: "900px", maxWidth: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
              <div>
                <span style={{ fontSize: "11px", color: "var(--primary-color)", fontWeight: "bold" }}>TEMPLATE SUBMISSIONS HISTORIC LOG</span>
                <h3 style={{ margin: 0, fontSize: "18px" }}>{activeTemplate.title}</h3>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => setActiveTemplate(null)}
                style={{ padding: "6px 12px", width: "auto" }}
              >
                ✕ Close
              </button>
            </div>

            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <input
                type="text"
                className="form-input"
                value={submissionSearch}
                onChange={(e) => setSubmissionSearch(e.target.value)}
                placeholder="Search by Signer Name or Email..."
                style={{ flex: 1, padding: "8px 12px", fontSize: "13px" }}
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

            <div style={{ flex: 1, overflowY: "auto" }}>
              {loadingSubmissions ? (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                  Retrieving historic signatures logs...
                </div>
              ) : filteredSubmissions.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                  No submission logs found for this template.
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ cursor: "pointer" }} onClick={() => {
                          setSubmissionSortBy("createdAt");
                          setSubmissionSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
                        }}>
                          Date Signed {submissionSortBy === "createdAt" ? (submissionSortOrder === "asc" ? "▲" : "▼") : ""}
                        </th>
                        <th style={{ cursor: "pointer" }} onClick={() => {
                          setSubmissionSortBy("signerName");
                          setSubmissionSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
                        }}>
                          Signer Name {submissionSortBy === "signerName" ? (submissionSortOrder === "asc" ? "▲" : "▼") : ""}
                        </th>
                        <th>Signer Email</th>
                        <th>Submission Payload</th>
                        <th style={{ textAlign: "right" }}>PDF</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSubmissions.map((doc) => {
                        const date = new Date(doc.createdAt).toLocaleString();
                        const formData = JSON.parse(doc.formDataJson);
                        return (
                          <tr key={doc.id}>
                            <td style={{ fontSize: "12px" }}>{date}</td>
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
                              <a
                                href={`/api/download/signed/${getFilename(doc.signedPdfPath)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-secondary"
                                style={{ padding: "4px 8px", fontSize: "11px", width: "auto" }}
                              >
                                View PDF
                              </a>
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
        </div>
      )}
    </div>
  );
}
