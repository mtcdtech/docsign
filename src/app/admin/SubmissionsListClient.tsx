"use client";

import React, { useState } from "react";
import FormPreviewModal from "@/components/FormPreviewModal";

interface Org {
  name: string;
}

interface Tpl {
  id: string;
  title: string;
  pdfPath: string;
  fieldsJson: string;
  saveSharepoint: boolean;
  emailParent: boolean;
  organization: Org;
}

interface Submission {
  id: string;
  signerName: string;
  signerEmail: string;
  formDataJson: string;
  signedPdfPath: string | null;
  createdAt: string;
  sharepointUrl: string | null;
  emailedUser: boolean;
  emailedLeader: boolean;
  emailedParent: boolean;
  isDraft: boolean;
  template: Tpl;
}

interface SubmissionsListClientProps {
  signedDocs: Submission[];
  portalTimezone?: string;
}

export default function SubmissionsListClient({ signedDocs, portalTimezone = "America/Chicago" }: SubmissionsListClientProps) {
  const [previewDoc, setPreviewDoc] = useState<Submission | null>(null);

  return (
    <>
      <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
        {signedDocs.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
            No completed signatures found yet.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Signer Name</th>
                <th>Template</th>
                <th>Organization</th>
                <th>Date Signed</th>
                <th>Integrations</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {signedDocs.map((doc) => {
                const downloadUrl = doc.signedPdfPath ? `/uploads/signed/${doc.signedPdfPath.split(/[/\\]/).pop()}` : null;
                
                // Fallback resolved signer name from variables
                let displaySignerName = doc.signerName;
                if (displaySignerName === "Anonymous Draft" || !displaySignerName) {
                  try {
                    const formData = JSON.parse(doc.formDataJson);
                    const fields = JSON.parse(doc.template.fieldsJson) || [];
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
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{displaySignerName}</div>
                        {doc.isDraft && (
                          <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "#f59e0b", color: "#fff", fontWeight: "bold" }}>
                            Draft
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "12px" }}>{doc.signerEmail || "(Unspecified)"}</div>
                    </td>
                    <td>{doc.template.title}</td>
                    <td>{doc.template.organization.name}</td>
                    <td suppressHydrationWarning>{new Date(doc.createdAt).toLocaleString("en-US", { timeZone: portalTimezone })}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {doc.isDraft ? (
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>
                          Draft – No integrations run yet
                        </span>
                      ) : (
                        <div style={{ display: "flex", gap: "8px", fontSize: "11px" }}>
                          <span style={{ color: doc.emailedUser ? "#22c55e" : "#ef4444" }}>
                            {doc.emailedUser ? "✓ User Email" : "✗ User Email"}
                          </span>
                          <span style={{ color: doc.emailedLeader ? "#22c55e" : "#ef4444" }}>
                            {doc.emailedLeader ? "✓ Leader Email" : "✗ Leader Email"}
                          </span>
                          {doc.template.emailParent && (
                            <span style={{ color: doc.emailedParent ? "#22c55e" : "#ef4444" }}>
                              {doc.emailedParent ? "✓ Parent Email" : "✗ Parent Email"}
                            </span>
                          )}
                          {doc.template.saveSharepoint && (
                            doc.sharepointUrl ? (
                              <a
                                href={doc.sharepointUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: "#22c55e", textDecoration: "none", cursor: "pointer", fontWeight: "bold" }}
                              >
                                ✓ SharePoint 🔗
                              </a>
                            ) : (
                              <span style={{ color: "#ef4444" }}>
                                ✗ SharePoint
                              </span>
                            )
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                      {doc.isDraft ? (
                        <span style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic", paddingRight: "12px" }}>
                          In Progress
                        </span>
                      ) : (
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                          {doc.sharepointUrl && (
                            <a
                              href={doc.sharepointUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-secondary"
                              style={{ padding: "6px 12px", fontSize: "12px", width: "auto" }}
                            >
                              SharePoint
                            </a>
                          )}
                          {downloadUrl && (
                            <a
                              href={downloadUrl}
                              download
                              className="btn btn-primary"
                              style={{ padding: "6px 12px", fontSize: "12px", width: "auto" }}
                            >
                              Download PDF
                            </a>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {previewDoc && (
        <FormPreviewModal 
          submission={previewDoc} 
          template={previewDoc.template} 
          onClose={() => setPreviewDoc(null)} 
        />
      )}
    </>
  );
}


