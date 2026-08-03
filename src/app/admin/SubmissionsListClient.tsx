"use client";

import React, { useState, useEffect } from "react";

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
}

export default function SubmissionsListClient({ signedDocs }: SubmissionsListClientProps) {
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
                    <td suppressHydrationWarning>{new Date(doc.createdAt).toLocaleString()}</td>
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

/* Internal FormPreviewModal Component */
function FormPreviewModal({ 
  submission, 
  template, 
  onClose 
}: { 
  submission: Submission; 
  template: Tpl; 
  onClose: () => void; 
}) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pdfjsLoaded, setPdfjsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if ((window as any).pdfjsLib) {
      setPdfjsLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "/js/pdf.min.js";
    script.async = true;
    script.onload = () => setPdfjsLoaded(true);
    document.body.appendChild(script);
  }, []);

  const filename = template.pdfPath.split(/[/\\]/).pop() || "";
  const pdfUrl = `/api/download/templates/${filename}`;

  useEffect(() => {
    if (!pdfjsLoaded) return;
    
    let active = true;
    const renderPdf = async () => {
      setLoading(true);
      try {
        const pdfjsLib = (window as any).pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/js/pdf.worker.min.js";
        
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        if (!active) return;
        setNumPages(pdf.numPages);

        setTimeout(async () => {
          for (let i = 1; i <= pdf.numPages; i++) {
            if (!active) break;
            const page = await pdf.getPage(i);
            const canvas = document.getElementById(`dashboard-preview-pdf-canvas-${i - 1}`) as HTMLCanvasElement;
            if (!canvas) continue;

            const context = canvas.getContext("2d");
            if (!context) continue;

            const viewport = page.getViewport({ scale: 1.2 });
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            const renderContext = {
              canvasContext: context,
              viewport: viewport,
            };
            await page.render(renderContext).promise;
          }
          if (active) setLoading(false);
        }, 100);
      } catch (err) {
        console.error("Error rendering preview PDF:", err);
        if (active) setLoading(false);
      }
    };

    renderPdf();
    return () => {
      active = false;
    };
  }, [pdfjsLoaded, pdfUrl]);

  let formData: Record<string, string> = {};
  try {
    formData = JSON.parse(submission.formDataJson) || {};
  } catch (e) {}

  let fields: any[] = [];
  try {
    fields = JSON.parse(template.fieldsJson) || [];
  } catch (e) {}

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.8)",
      zIndex: 99999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backdropFilter: "blur(4px)",
    }} onClick={onClose}>
      <div className="card-glass" style={{
        width: "800px",
        height: "85vh",
        maxWidth: "95%",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.3)",
        border: "1px solid var(--border-color)",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "bold" }}>Form Current State Preview</h3>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {submission.signerName} ({submission.signerEmail || "No email"}) • {submission.isDraft ? "Draft In Progress" : "Completed"}
            </span>
          </div>
          <button 
            onClick={onClose}
            className="btn btn-secondary"
            style={{ width: "auto", padding: "6px 12px", fontSize: "13px" }}
          >
            Close Preview
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", background: "rgba(0,0,0,0.3)", borderRadius: "8px", padding: "20px", display: "flex", flexDirection: "column", gap: "24px", alignItems: "center", position: "relative" }}>
          {loading && (
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", color: "var(--text-muted)", fontSize: "14px" }}>
              Generating form state preview...
            </div>
          )}

          {Array.from({ length: numPages }).map((_, pageIdx) => {
            const pageFields = fields.filter((f: any) => f.page === pageIdx);
            
            return (
              <div 
                key={pageIdx}
                style={{ 
                  position: "relative",
                  boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
                  borderRadius: "4px",
                  overflow: "hidden",
                  width: "100%",
                  maxWidth: "680px",
                  aspectRatio: "8.5 / 11",
                  background: "#fff",
                }}
              >
                <canvas 
                  id={`dashboard-preview-pdf-canvas-${pageIdx}`} 
                  style={{ display: "block", width: "100%", height: "100%" }} 
                />
                
                <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
                  {pageFields.map((field: any) => {
                    const value = formData[field.id] || "";
                    
                    return (
                      <div
                        key={field.id}
                        style={{
                          position: "absolute",
                          left: `${field.x * 100}%`,
                          top: `${field.y * 100}%`,
                          width: `${field.width * 100}%`,
                          height: `${field.height * 100}%`,
                          border: "1px solid rgba(79, 70, 229, 0.4)",
                          backgroundColor: "rgba(79, 70, 229, 0.05)",
                          display: "flex",
                          alignItems: "center",
                          padding: "0 4px",
                          boxSizing: "border-box",
                        }}
                      >
                        {field.type === "signature" ? (
                          value ? (
                            <img 
                              src={value} 
                              alt="Signature" 
                              style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain", margin: "auto" }} 
                            />
                          ) : (
                            <span style={{ fontSize: "10px", color: "var(--text-muted)", fontStyle: "italic", margin: "auto" }}>
                              Signature Pad
                            </span>
                          )
                        ) : (
                          <div style={{
                            fontSize: "11px",
                            color: "#1e1b4b",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            width: "100%",
                          }}>
                            {value}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
