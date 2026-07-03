"use client";

import React, { useState, useEffect, useRef } from "react";
import Script from "next/script";
import SignaturePad from "@/components/SignaturePad";

interface FieldMapping {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FormField {
  id: string;
  label: string;
  type: "text" | "date" | "number" | "checkbox" | "signature" | "signer_name" | "signer_email";
  required: boolean;
  pdfMapping: FieldMapping;
  conditional?: {
    field: string;
    operator: "equals" | "age_less_than" | "checked";
    value: any;
  };
}

interface SignFormProps {
  template: {
    id: string;
    title: string;
    slug: string;
    fieldsJson: string;
    organization: {
      name: string;
    };
  };
  portalTitle: string;
  portalLogo: string;
  pdfUrl: string;
}

export default function SignForm({ template, portalTitle, portalLogo, pdfUrl }: SignFormProps) {
  const fields = JSON.parse(template.fieldsJson) as FormField[];
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // PDF.js rendering states
  const [pdfjsLoaded, setPdfjsLoaded] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const renderedPagesRef = useRef<Set<number>>(new Set());

  // Interactive signature modal state
  const [activeSignatureFieldId, setActiveSignatureFieldId] = useState<string | null>(null);

  useEffect(() => {
    const currentTheme = document.documentElement.getAttribute("data-theme") as "dark" | "light" || "dark";
    setTheme(currentTheme);
  }, []);

  // Check if pdfjs is already loaded in window
  useEffect(() => {
    // @ts-ignore
    if (window.pdfjsLib || window["pdfjs-dist/build/pdf"]) {
      setPdfjsLoaded(true);
    }
  }, []);

  // PDF.js Preview Canvas Render Loop
  useEffect(() => {
    if (!pdfjsLoaded) return;

    const renderPDF = async () => {
      try {
        setLoadingPdf(true);
        // @ts-ignore
        const pdfjsLib = window["pdfjs-dist/build/pdf"] || window.pdfjsLib;
        if (!pdfjsLib) return;
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/js/pdf.worker.min.js";

        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        setNumPages(pdf.numPages);
        setLoadingPdf(false);

        // Sequentially render preview canvases
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (renderedPagesRef.current.has(pageNum)) continue;

          const page = await pdf.getPage(pageNum);
          const canvas = document.getElementById(`pdf-preview-canvas-${pageNum - 1}`) as HTMLCanvasElement;
          if (!canvas) continue;

          const ctx = canvas.getContext("2d");
          if (!ctx) continue;

          const viewport = page.getViewport({ scale: 1.2 });
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          // Set overlay size to match canvas dimensions
          const overlay = document.getElementById(`pdf-preview-overlay-${pageNum - 1}`);
          if (overlay) {
            overlay.style.width = `${viewport.width}px`;
            overlay.style.height = `${viewport.height}px`;
          }

          await page.render({ canvasContext: ctx, viewport }).promise;
          renderedPagesRef.current.add(pageNum);
        }
      } catch (err) {
        console.error("Error loading template preview document:", err);
      } finally {
        setLoadingPdf(false);
      }
    };

    renderPDF();
  }, [pdfjsLoaded, pdfUrl]);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("theme-mode", nextTheme);
  };

  const getAge = (dobString: string): number => {
    if (!dobString) return 0;
    const today = new Date();
    const birth = new Date(dobString);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const isFieldVisible = (field: FormField): boolean => {
    if (!field.conditional) return true;

    const { field: targetFieldId, operator, value } = field.conditional;
    const targetVal = formData[targetFieldId];

    if (operator === "checked") {
      return targetVal === true || targetVal === "true" || targetVal === "on";
    }

    if (operator === "age_less_than") {
      if (!targetVal) return false;
      const age = getAge(targetVal);
      return age < Number(value);
    }

    if (operator === "equals") {
      return String(targetVal) === String(value);
    }

    return true;
  };

  const handleInputChange = (fieldId: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  // Calculate required fields status in real-time
  const visibleFields = fields.filter(isFieldVisible);
  const remainingRequiredFields = visibleFields.filter((f) => {
    if (f.type === "signer_name") return !signerName.trim();
    if (f.type === "signer_email") return !signerEmail.trim();
    if (!f.required) return false;
    const val = formData[f.id];
    return val === undefined || val === null || val === "";
  });
  const remainingCount = remainingRequiredFields.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!signerName.trim() || !signerEmail.trim()) {
      setSubmitError("Please fill out your name and email.");
      return;
    }

    if (remainingCount > 0) {
      setSubmitError(`Please fill out the remaining ${remainingCount} required fields highlighted on the document.`);
      return;
    }

    setIsSubmitting(true);

    // Auto-fill discrete name and email variables into the form data payload
    const finalFormData = { ...formData };
    fields.forEach((f) => {
      if (f.type === "signer_name") {
        finalFormData[f.id] = signerName;
      } else if (f.type === "signer_email") {
        finalFormData[f.id] = signerEmail;
      }
    });

    try {
      const res = await fetch(`/api/sign/${template.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signerName,
          signerEmail,
          formData: finalFormData,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit document.");
      }

      setSignedPdfUrl(data.pdfUrl || `/uploads/signed/${data.signedDocumentId}.pdf`);
    } catch (err: any) {
      setSubmitError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (signedPdfUrl) {
    return (
      <div className="card-glass" style={{ maxWidth: "600px", margin: "40px auto", textAlign: "center", padding: "40px" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎉</div>
        <h2>Thank You!</h2>
        <p style={{ margin: "16px 0 24px" }}>
          Your document has been successfully signed and processed. A copy has been emailed to you and the organization leader.
        </p>
        <div style={{ display: "flex", gap: "16px", flexDirection: "column" }}>
          <a
            href={signedPdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            Download Completed PDF
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <Script
        src="/js/pdf.min.js"
        onLoad={() => setPdfjsLoaded(true)}
      />

      <div style={{ position: "relative", maxWidth: "1400px", margin: "0 auto", padding: "10px 0 40px" }}>
        
        {/* Header and Brand */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", paddingBottom: "16px", borderBottom: "1px solid var(--border-color)" }}>
          <div>
            {portalLogo && (
              <img
                src={portalLogo}
                alt="Logo"
                style={{ maxHeight: "36px", maxWidth: "150px", objectFit: "contain", marginBottom: "8px" }}
              />
            )}
            <div>
              <span style={{ fontSize: "11px", color: "var(--primary-color)", fontWeight: "bold", textTransform: "uppercase" }}>
                {template.organization.name}
              </span>
              <h2 style={{ marginTop: "2px", fontSize: "20px" }}>{template.title}</h2>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="btn btn-secondary"
            style={{ width: "36px", height: "36px", borderRadius: "50%", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
            title="Toggle Theme"
          >
            {theme === "dark" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>

        {/* Split screen signing workspace */}
        <div style={{ display: "flex", gap: "32px", alignItems: "stretch", flexWrap: "wrap" }}>
          
          {/* Left Side: PDF Document Viewer with Overlay Interactive Inputs */}
          <div style={{ flex: "1.2", minWidth: "320px", display: "flex", flexDirection: "column", gap: "16px", maxHeight: "calc(100vh - 160px)", overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: "8px", padding: "16px", background: "rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
              <h3 style={{ margin: 0, fontSize: "15px" }}>Document Preview</h3>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Click directly on the fields overlaying the document to fill them in.
              </span>
            </div>

            {loadingPdf ? (
              <div style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)" }}>
                Rendering document pages...
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px", alignItems: "center" }}>
                {Array.from({ length: numPages }).map((_, pageIdx) => (
                  <div
                    key={pageIdx}
                    id={`pdf-preview-overlay-${pageIdx}`}
                    style={{
                      position: "relative",
                      border: "1px solid var(--border-color)",
                      borderRadius: "4px",
                      background: "#000",
                    }}
                  >
                    <canvas
                      id={`pdf-preview-canvas-${pageIdx}`}
                      style={{ display: "block", maxWidth: "100%", height: "auto" }}
                    />
                    
                    {/* Absolute Overlay Fields */}
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        zIndex: 10,
                      }}
                    >
                      {fields
                        .filter((f) => f.pdfMapping.page === pageIdx)
                        .map((f) => {
                          const isVisible = isFieldVisible(f);
                          if (!isVisible) return null;

                          const mapping = f.pdfMapping;
                          const val = formData[f.id] || "";

                          const style: React.CSSProperties = {
                            position: "absolute",
                            left: `${mapping.x}%`,
                            top: `${mapping.y}%`,
                            width: `${mapping.width}px`,
                            height: `${mapping.height}px`,
                            boxSizing: "border-box",
                            zIndex: 20,
                          };

                          if (f.type === "signature") {
                            return (
                              <div
                                key={f.id}
                                onClick={() => setActiveSignatureFieldId(f.id)}
                                style={{
                                  ...style,
                                  border: val ? "2px solid #10b981" : "2.5px dashed var(--primary-color)",
                                  background: val ? "rgba(16, 185, 129, 0.1)" : "rgba(var(--primary-rgb), 0.12)",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  borderRadius: "4px",
                                  overflow: "hidden"
                                }}
                                title="Click to draw signature"
                              >
                                {val ? (
                                  <img src={val} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                                ) : (
                                  <span style={{ fontSize: "10px", color: "var(--primary-color)", fontWeight: "bold", textAlign: "center" }}>
                                    ✍️ Sign Here {f.required && "*"}
                                  </span>
                                )}
                              </div>
                            );
                          }

                          if (f.type === "checkbox") {
                            return (
                              <input
                                key={f.id}
                                type="checkbox"
                                checked={val === true}
                                onChange={(e) => handleInputChange(f.id, e.target.checked)}
                                style={{
                                  ...style,
                                  accentColor: "var(--primary-color)",
                                  cursor: "pointer",
                                  margin: 0,
                                }}
                              />
                            );
                          }

                          if (f.type === "signer_name") {
                            return (
                              <input
                                key={f.id}
                                type="text"
                                readOnly
                                value={signerName}
                                placeholder="Signer Name"
                                style={{
                                  ...style,
                                  border: signerName ? "1px solid #10b981" : "2px dashed var(--primary-color)",
                                  background: "rgba(15, 23, 42, 0.95)",
                                  color: "white",
                                  fontSize: "11px",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  outline: "none"
                                }}
                                title="Pre-populated from Section 1"
                              />
                            );
                          }

                          if (f.type === "signer_email") {
                            return (
                              <input
                                key={f.id}
                                type="text"
                                readOnly
                                value={signerEmail}
                                placeholder="Signer Email"
                                style={{
                                  ...style,
                                  border: signerEmail ? "1px solid #10b981" : "2px dashed var(--primary-color)",
                                  background: "rgba(15, 23, 42, 0.95)",
                                  color: "white",
                                  fontSize: "11px",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  outline: "none"
                                }}
                                title="Pre-populated from Section 1"
                              />
                            );
                          }

                          // Default: text, date, number inputs
                          return (
                            <input
                              key={f.id}
                              type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
                              value={val}
                              onChange={(e) => handleInputChange(f.id, e.target.value)}
                              placeholder={f.required ? `${f.label} *` : f.label}
                              style={{
                                ...style,
                                background: "rgba(15, 23, 42, 0.95)",
                                color: "white",
                                fontSize: "11px",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                border: val ? "1px solid #10b981" : f.required ? "2.5px solid var(--primary-color)" : "1px solid rgba(255,255,255,0.4)",
                                outline: "none",
                                height: `${mapping.height}px`,
                              }}
                            />
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Side: Signer Form Credentials & Validation checklist */}
          <div className="card-glass" style={{ flex: "1", minWidth: "320px", padding: "24px", display: "flex", flexDirection: "column", gap: "20px", maxHeight: "calc(100vh - 160px)", overflowY: "auto" }}>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              
              <div>
                <h3 style={{ margin: 0 }}>1. Signer Information</h3>
                <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--text-muted)" }}>
                  Enter your credentials below to authenticate the signature. These will automatically populate your name/email fields on the document.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="John Doe"
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Email Address *</label>
                  <input
                    type="email"
                    className="form-input"
                    required
                    value={signerEmail}
                    onChange={(e) => setSignerEmail(e.target.value)}
                    placeholder="john.doe@example.com"
                  />
                </div>
              </div>

              {/* Progress Checklist Bar */}
              <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "20px" }}>
                <h3 style={{ margin: 0 }}>2. Document Completion</h3>
                <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--text-muted)" }}>
                  Fill in all required fields highlighted directly on the document on the left.
                </p>
                
                <div style={{ marginTop: "12px", padding: "12px", borderRadius: "6px", background: remainingCount > 0 ? "rgba(239, 68, 68, 0.08)" : "rgba(16, 185, 129, 0.08)", border: remainingCount > 0 ? "1px solid rgba(239, 68, 68, 0.2)" : "1px solid rgba(16, 185, 129, 0.2)", fontSize: "13px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>
                  {remainingCount > 0 ? (
                    <>
                      <span style={{ color: "#ef4444" }}>⚠️</span>
                      <span style={{ color: "var(--text-main)" }}>
                        {remainingCount} required field(s) remaining
                      </span>
                    </>
                  ) : (
                    <>
                      <span style={{ color: "#10b981" }}>✅</span>
                      <span style={{ color: "var(--text-main)" }}>
                        All required fields completed! Ready to sign.
                      </span>
                    </>
                  )}
                </div>
              </div>

              {submitError && (
                <div style={{ color: "#ef4444", fontSize: "13px", fontWeight: "bold", background: "rgba(239, 68, 68, 0.1)", padding: "12px", borderRadius: "6px", border: "1px solid rgba(239, 68, 68, 0.2)", marginTop: "10px" }}>
                  ⚠️ {submitError}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
                style={{ width: "100%", padding: "14px", marginTop: "10px" }}
              >
                {isSubmitting ? "Signing & Processing..." : "Sign Document"}
              </button>

            </form>
          </div>

        </div>

      </div>

      {/* Signature Pad Drawing Drawer Overlay */}
      {activeSignatureFieldId && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div className="card-glass" style={{ width: "500px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "bold" }}>Draw Signature</h3>
              <button
                className="btn btn-secondary"
                onClick={() => setActiveSignatureFieldId(null)}
                style={{ padding: "4px 8px", width: "auto" }}
              >
                ✕
              </button>
            </div>
            
            <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>
              Draw your signature cleanly inside the boundaries below:
            </p>

            <SignaturePad
              onChange={(val) => {
                handleInputChange(activeSignatureFieldId, val);
              }}
            />

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "8px" }}>
              <button
                className="btn btn-primary"
                onClick={() => setActiveSignatureFieldId(null)}
                style={{ width: "auto", minWidth: "100px" }}
              >
                Insert Signature
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
