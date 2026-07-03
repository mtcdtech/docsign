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

          const viewport = page.getViewport({ scale: 1.1 });
          canvas.width = viewport.width;
          canvas.height = viewport.height;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!signerName.trim() || !signerEmail.trim()) {
      setSubmitError("Please fill out your name and email.");
      return;
    }

    // Validate visible required fields
    const visibleFields = fields.filter(isFieldVisible);
    for (const f of visibleFields) {
      // Signer Name and Signer Email are automatically filled from Section 1
      if (f.type === "signer_name" || f.type === "signer_email") continue;

      const val = formData[f.id];
      if (f.required && (val === undefined || val === null || val === "")) {
        setSubmitError(`Please fill out the required field: ${f.label}`);
        return;
      }
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
          
          {/* Left Side: PDF Document Viewer */}
          <div style={{ flex: "1.2", minWidth: "320px", display: "flex", flexDirection: "column", gap: "16px", maxHeight: "calc(100vh - 160px)", overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: "8px", padding: "16px", background: "rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
              <h3 style={{ margin: 0, fontSize: "15px" }}>Document Preview</h3>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Verify the sheets you are signing
              </span>
            </div>

            {loadingPdf ? (
              <div style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)" }}>
                Rendering document pages...
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px", alignItems: "center" }}>
                {Array.from({ length: numPages }).map((_, pageIdx) => (
                  <canvas
                    key={pageIdx}
                    id={`pdf-preview-canvas-${pageIdx}`}
                    style={{ border: "1px solid var(--border-color)", borderRadius: "4px", maxWidth: "100%", height: "auto", display: "block", background: "#000" }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right Side: Signer Form Questionnaire */}
          <div className="card-glass" style={{ flex: "1", minWidth: "320px", padding: "24px", display: "flex", flexDirection: "column", gap: "20px", maxHeight: "calc(100vh - 160px)", overflowY: "auto" }}>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              
              <div>
                <h3 style={{ margin: 0 }}>1. Signer Information</h3>
                <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--text-muted)" }}>
                  Enter your credentials below to authenticate the signature.
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

              {/* Exclude signer name/email from questionnaire, as they are collected above */}
              {fields.filter((f) => f.type !== "signer_name" && f.type !== "signer_email").length > 0 && (
                <>
                  <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "20px" }}>
                    <h3 style={{ margin: 0 }}>2. Questionnaire</h3>
                    <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--text-muted)" }}>
                      Fill in the custom fields requested by the document.
                    </p>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    {fields
                      .filter((f) => f.type !== "signer_name" && f.type !== "signer_email")
                      .map((field) => {
                        if (!isFieldVisible(field)) return null;

                        return (
                          <div key={field.id} className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">
                              {field.label} {field.required ? "*" : ""}
                            </label>

                            {field.type === "signature" ? (
                              <SignaturePad
                                onChange={(val) => handleInputChange(field.id, val)}
                              />
                            ) : field.type === "checkbox" ? (
                              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>
                                <input
                                  type="checkbox"
                                  checked={formData[field.id] === true}
                                  onChange={(e) => handleInputChange(field.id, e.target.checked)}
                                  style={{ width: "18px", height: "18px", accentColor: "var(--primary-color)" }}
                                />
                                I agree / confirm
                              </label>
                            ) : field.type === "date" ? (
                              <input
                                type="date"
                                className="form-input"
                                required={field.required}
                                value={formData[field.id] || ""}
                                onChange={(e) => handleInputChange(field.id, e.target.value)}
                              />
                            ) : field.type === "number" ? (
                              <input
                                type="number"
                                className="form-input"
                                required={field.required}
                                value={formData[field.id] || ""}
                                onChange={(e) => handleInputChange(field.id, e.target.value)}
                                placeholder="Enter number"
                              />
                            ) : (
                              <input
                                type="text"
                                className="form-input"
                                required={field.required}
                                value={formData[field.id] || ""}
                                onChange={(e) => handleInputChange(field.id, e.target.value)}
                                placeholder={`Enter ${field.label.toLowerCase()}`}
                              />
                            )}
                          </div>
                        );
                      })}
                  </div>
                </>
              )}

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
    </>
  );
}
