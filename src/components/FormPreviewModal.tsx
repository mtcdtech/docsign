"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";

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

interface FormPreviewModalProps {
  submission: Submission;
  template: Tpl;
  onClose: () => void;
}

export default function FormPreviewModal({ submission, template, onClose }: FormPreviewModalProps) {
  const [mounted, setMounted] = useState(false);
  const [numPages, setNumPages] = useState<number>(0);
  const [pdfjsLoaded, setPdfjsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if ((window as any).pdfjsLib) {
      setPdfjsLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "/js/pdf.min.js";
    script.async = true;
    script.onload = () => setPdfjsLoaded(true);
    document.body.appendChild(script);
  }, [mounted]);

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
            const canvas = document.getElementById(`shared-preview-pdf-canvas-${i - 1}`) as HTMLCanvasElement;
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

  if (!mounted) return null;

  let formData: Record<string, string> = {};
  try {
    formData = JSON.parse(submission.formDataJson) || {};
  } catch (e) {}

  let fields: any[] = [];
  try {
    fields = JSON.parse(template.fieldsJson) || [];
  } catch (e) {}

  // Fallback resolved signer name from variables
  let displaySignerName = submission.signerName;
  if (displaySignerName === "Anonymous Draft" || !displaySignerName) {
    try {
      const nameField = fields.find((f: any) => f.type === "signer_name");
      if (nameField && formData[nameField.id]) {
        displaySignerName = formData[nameField.id];
      }
    } catch (e) {}
  }

  const modalJsx = (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.8)",
      zIndex: 999999,
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
              {displaySignerName} ({submission.signerEmail || "No email"}) • {submission.isDraft ? "Draft In Progress" : "Completed"}
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
                  background: "#fff",
                }}
              >
                <canvas 
                  id={`shared-preview-pdf-canvas-${pageIdx}`} 
                  style={{ display: "block", width: "100%", height: "auto" }} 
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

  return createPortal(modalJsx, document.body);
}
