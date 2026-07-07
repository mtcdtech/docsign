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
  type: "text" | "date" | "number" | "checkbox" | "signature" | "signer_name" | "signer_email" | "dob" | "age" | "todays_date" | "custom_email";
  required: boolean;
  pdfMapping: FieldMapping;
  conditional?: {
    field: string;
    operator: "equals" | "greater_than" | "less_than" | "checked" | "is_checked" | "age_less_than";
    value: any;
    fallbackValue?: string;
  };
}

interface SignFormProps {
  template: {
    id: string;
    title: string;
    slug: string;
    fieldsJson: string;
    emailUser: boolean;
    emailLeader: boolean;
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

  // Global reading order of all fields for sequential Tab navigation
  const sortedAllFields = [...fields].sort((a, b) => {
    if (a.pdfMapping.page !== b.pdfMapping.page) {
      return a.pdfMapping.page - b.pdfMapping.page;
    }
    if (Math.abs(a.pdfMapping.y - b.pdfMapping.y) > 2) {
      return a.pdfMapping.y - b.pdfMapping.y;
    }
    return a.pdfMapping.x - b.pdfMapping.x;
  });

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

  // Field highlight tracking
  const [highlightedFieldId, setHighlightedFieldId] = useState<string | null>(null);

  // Mobile layout detection & navigation states
  const [isMobile, setIsMobile] = useState(false);
  const [mobileActiveIdx, setMobileActiveIdx] = useState(0);

  // Load progress from browser localStorage if available
  useEffect(() => {
    const saved = localStorage.getItem(`docsign_progress_${template.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.signerName) setSignerName(parsed.signerName);
        if (parsed.signerEmail) setSignerEmail(parsed.signerEmail);
        if (parsed.formData) setFormData(parsed.formData);
      } catch (e) {
        console.error("Failed to parse saved signing progress:", e);
      }
    }
  }, [template.id]);

  // Persist progress to localStorage on change
  useEffect(() => {
    if (signerName || signerEmail || Object.keys(formData).length > 0) {
      localStorage.setItem(
        `docsign_progress_${template.id}`,
        JSON.stringify({ signerName, signerEmail, formData })
      );
    }
  }, [signerName, signerEmail, formData, template.id]);

  // Detect mobile view size
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Lock document vertical scroll completely on mobile
  useEffect(() => {
    if (isMobile) {
      document.body.style.overflow = "hidden";
      document.body.style.height = "100%";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
    } else {
      document.body.style.overflow = "";
      document.body.style.height = "";
      document.body.style.position = "";
      document.body.style.width = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.height = "";
      document.body.style.position = "";
      document.body.style.width = "";
    };
  }, [isMobile]);

  // Pre-fill today's date on all "todays_date" fields automatically on mount
  useEffect(() => {
    const todayStr = new Date().toLocaleDateString();
    setFormData((prev) => {
      const next = { ...prev };
      let changed = false;
      fields.forEach((f) => {
        if (f.type === "todays_date" && !next[f.id]) {
          next[f.id] = todayStr;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [fields]);

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

    if (operator === "checked" || operator === "is_checked") {
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

    if (operator === "greater_than") {
      if (targetVal === undefined || targetVal === null || targetVal === "") return false;
      return Number(targetVal) > Number(value);
    }

    if (operator === "less_than") {
      if (targetVal === undefined || targetVal === null || targetVal === "") return false;
      return Number(targetVal) < Number(value);
    }

    return true;
  };

  // Real-time automatic Age field synchronization based on Date of Birth (dob) values
  useEffect(() => {
    const dobFields = fields.filter((f) => f.type === "dob");
    if (dobFields.length > 0) {
      let dobValue = "";
      for (const df of dobFields) {
        if (formData[df.id]) {
          dobValue = formData[df.id];
          break;
        }
      }

      const ageFields = fields.filter((f) => f.type === "age");
      if (ageFields.length > 0) {
        let calculatedAgeStr = "";
        if (dobValue) {
          const birthDate = new Date(dobValue);
          if (!isNaN(birthDate.getTime())) {
            const today = new Date();
            let calculatedAge = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
              calculatedAge--;
            }
            calculatedAgeStr = calculatedAge.toString();
          }
        }

        let needsUpdate = false;
        const nextFormData = { ...formData };
        ageFields.forEach((af) => {
          if (formData[af.id] !== calculatedAgeStr) {
            nextFormData[af.id] = calculatedAgeStr;
            needsUpdate = true;
          }
        });

        if (needsUpdate) {
          setFormData(nextFormData);
        }
      }
    }
  }, [formData, fields]);

  const handleInputChange = (fieldId: string, value: any) => {
    setFormData((prev) => {
      const next = { ...prev, [fieldId]: value };
      return next;
    });
  };

  // Click remaining checklist fields to scroll, focus & highlight
  const handleChecklistItemClick = (fieldId: string) => {
    setHighlightedFieldId(fieldId);
    setTimeout(() => {
      setHighlightedFieldId(null);
    }, 2000); // Highlight duration: 2 seconds

    const element = document.getElementById(`field-input-box-${fieldId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.focus();
    }

    const field = fields.find((f) => f.id === fieldId);
    if (field?.type === "signature") {
      setActiveSignatureFieldId(fieldId);
    }
  };

  // Calculate required fields status in real-time
  const visibleFields = fields.filter(isFieldVisible);
  const remainingRequiredFields = visibleFields.filter((f) => {
    if (f.type === "signer_name") return !signerName.trim();
    if (f.type === "signer_email") return !signerEmail.trim();
    const val = formData[f.id];
    const isUnfilled = val === undefined || val === null || val === "";
    
    if (f.required) {
      return isUnfilled;
    }
    return false;
  });
  
  // Sort remaining fields from top-to-bottom, left-to-right
  const sortedRequiredFields = [...remainingRequiredFields].sort((a, b) => {
    if (a.pdfMapping.page !== b.pdfMapping.page) {
      return a.pdfMapping.page - b.pdfMapping.page;
    }
    if (Math.abs(a.pdfMapping.y - b.pdfMapping.y) > 2) {
      return a.pdfMapping.y - b.pdfMapping.y;
    }
    return a.pdfMapping.x - b.pdfMapping.x;
  });

  const remainingCount = sortedRequiredFields.length;

  // Handle next/prev arrow navigation on mobile
  const handleNavigateChecklist = (direction: "next" | "prev") => {
    if (sortedRequiredFields.length === 0) return;
    let nextIdx = 0;
    if (direction === "next") {
      nextIdx = mobileActiveIdx < sortedRequiredFields.length - 1 ? mobileActiveIdx + 1 : 0;
    } else {
      nextIdx = mobileActiveIdx > 0 ? mobileActiveIdx - 1 : sortedRequiredFields.length - 1;
    }
    setMobileActiveIdx(nextIdx);
    const fieldId = sortedRequiredFields[nextIdx].id;
    handleChecklistItemClick(fieldId);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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

    // Auto-fill discrete variables and conditional fallback values into the form data payload
    const finalFormData = { ...formData };
    fields.forEach((f) => {
      const isVisible = isFieldVisible(f);
      if (f.type === "signer_name") {
        finalFormData[f.id] = signerName;
      } else if (f.type === "signer_email") {
        finalFormData[f.id] = signerEmail;
      } else if (f.conditional && !isVisible) {
        if (f.conditional.fallbackValue !== undefined && f.conditional.fallbackValue !== null && f.conditional.fallbackValue !== "") {
          finalFormData[f.id] = f.conditional.fallbackValue;
        } else {
          delete finalFormData[f.id];
        }
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

      // Successful signing: clear localStorage progress cache
      localStorage.removeItem(`docsign_progress_${template.id}`);
      setSignedPdfUrl(data.pdfUrl || `/uploads/signed/${data.signedDocumentId}.pdf`);
    } catch (err: any) {
      setSubmitError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (signedPdfUrl) {
    const getConfirmationMessage = () => {
      const baseMsg = "Your document has been successfully signed and processed.";
      
      // Check if there are custom email addresses filled out
      const hasCustomEmails = fields.some(
        (f) => f.type === "custom_email" && formData[f.id] && String(formData[f.id]).trim().includes("@")
      );

      const emailUser = template.emailUser ?? true;
      const emailLeader = template.emailLeader ?? true;

      if (emailUser && emailLeader) {
        if (hasCustomEmails) {
          return `${baseMsg} A copy has been emailed to you, the organization leader, and the additional email address(es) provided.`;
        }
        return `${baseMsg} A copy has been emailed to you and the organization leader.`;
      }
      
      if (emailUser) {
        if (hasCustomEmails) {
          return `${baseMsg} A copy has been emailed to you and the additional email address(es) provided.`;
        }
        return `${baseMsg} A copy has been emailed to you.`;
      }
      
      if (emailLeader) {
        return `${baseMsg} A copy has been emailed to the organization leader.`;
      }
      
      return baseMsg;
    };

    return (
      <div className="card-glass" style={{ maxWidth: "600px", margin: "40px auto", textAlign: "center", padding: "40px" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎉</div>
        <h2>Thank You!</h2>
        <p style={{ margin: "16px 0 24px" }}>
          {getConfirmationMessage()}
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

      <div style={{ position: "relative", maxWidth: "1400px", margin: "0 auto", padding: "10px 0 80px" }}>
        
        {/* Compressed Header and Brand next to logo with Exit triggers */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", paddingBottom: "16px", borderBottom: "1px solid var(--border-color)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {portalLogo && (
              <img
                src={portalLogo}
                alt="Logo"
                style={{ maxHeight: "40px", maxWidth: "150px", objectFit: "contain" }}
              />
            )}
            <div style={{ borderLeft: portalLogo ? "1px solid var(--border-color)" : "none", paddingLeft: portalLogo ? "16px" : 0 }}>
              <span style={{ fontSize: "11px", color: "var(--primary-color)", fontWeight: "bold", textTransform: "uppercase", display: "block", lineHeight: "1" }}>
                {template.organization.name}
              </span>
              <h2 style={{ margin: "4px 0 0 0", fontSize: "18px", lineHeight: "1.2" }}>{template.title}</h2>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
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

            <button
              type="button"
              onClick={() => window.location.href = "/"}
              className="btn btn-secondary"
              style={{ padding: "0 16px", height: "36px", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}
              title="Exit signing workspace"
            >
              ✕ Exit
            </button>
          </div>
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
              <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%", alignItems: "stretch" }}>
                {Array.from({ length: numPages }).map((_, pageIdx) => (
                  <div
                    key={pageIdx}
                    style={{
                      width: "100%",
                      overflowX: "auto",
                      WebkitOverflowScrolling: "touch",
                      display: "flex",
                      justifyContent: isMobile ? "flex-start" : "center",
                      background: "rgba(0,0,0,0.05)",
                      paddingBottom: "8px"
                    }}
                  >
                    <div
                      id={`pdf-preview-overlay-${pageIdx}`}
                      style={{
                        position: "relative",
                        border: "1px solid var(--border-color)",
                        borderRadius: "4px",
                        background: "#000",
                        flexShrink: 0
                      }}
                    >
                      <canvas
                        id={`pdf-preview-canvas-${pageIdx}`}
                        style={{ display: "block" }}
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
                          const hasFallback = f.conditional?.fallbackValue !== undefined && f.conditional?.fallbackValue !== null && f.conditional?.fallbackValue !== "";
                          if (!isVisible && !hasFallback) return null;

                          const mapping = f.pdfMapping;
                          const val = isVisible ? (formData[f.id] || "") : (f.conditional?.fallbackValue || "");
                          const isHighlighted = f.id === highlightedFieldId;

                          const style: React.CSSProperties = {
                            position: "absolute",
                            left: `${mapping.x}%`,
                            top: `${mapping.y}%`,
                            width: `${mapping.width}px`,
                            height: `${mapping.height}px`,
                            boxSizing: "border-box",
                            zIndex: 20,
                            transition: "all 0.3s ease",
                          };

                          const tabIdx = sortedAllFields.findIndex((sf) => sf.id === f.id) + 1;

                          if (f.type === "signature") {
                            if (!isVisible) {
                              return (
                                <input
                                  key={f.id}
                                  type="text"
                                  value={val}
                                  disabled
                                  readOnly
                                  style={{
                                    ...style,
                                    background: "rgba(255, 255, 255, 0.05)",
                                    color: "var(--text-main)",
                                    fontSize: "11px",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    border: "1px solid var(--border-color)",
                                    outline: "none",
                                    height: `${mapping.height}px`,
                                    cursor: "not-allowed",
                                  }}
                                />
                              );
                            }
                            return (
                              <div
                                key={f.id}
                                id={`field-input-box-${f.id}`}
                                onClick={() => setActiveSignatureFieldId(f.id)}
                                tabIndex={tabIdx}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setActiveSignatureFieldId(f.id);
                                  }
                                }}
                                style={{
                                  ...style,
                                  border: isHighlighted
                                    ? "3px solid #f59e0b"
                                    : val
                                    ? "2px solid #10b981"
                                    : "2.5px dashed var(--primary-color)",
                                  background: val ? "rgba(16, 185, 129, 0.1)" : "rgba(var(--primary-rgb), 0.12)",
                                  boxShadow: isHighlighted ? "0 0 14px #f59e0b, 0 0 0 3px rgba(245, 158, 11, 0.4)" : "none",
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
                                id={`field-input-box-${f.id}`}
                                type="checkbox"
                                checked={val === true || val === "true" || val === "on"}
                                disabled={!isVisible}
                                tabIndex={isVisible ? tabIdx : -1}
                                onChange={(e) => isVisible && handleInputChange(f.id, e.target.checked)}
                                style={{
                                  ...style,
                                  accentColor: "var(--primary-color)",
                                  cursor: isVisible ? "pointer" : "not-allowed",
                                  margin: 0,
                                  boxShadow: isHighlighted ? "0 0 14px #f59e0b, 0 0 0 3px rgba(245, 158, 11, 0.4)" : "none",
                                }}
                              />
                            );
                          }

                          if (f.type === "signer_name") {
                            return (
                              <input
                                key={f.id}
                                id={`field-input-box-${f.id}`}
                                type="text"
                                value={isVisible ? signerName : val}
                                disabled={!isVisible}
                                readOnly={!isVisible}
                                tabIndex={isVisible ? tabIdx : -1}
                                onChange={(e) => isVisible && setSignerName(e.target.value)}
                                placeholder="Signer Name"
                                style={{
                                  ...style,
                                  border: isHighlighted
                                    ? "3px solid #f59e0b"
                                    : (isVisible ? signerName : val)
                                    ? "1.5px solid #10b981"
                                    : "2px dashed var(--primary-color)",
                                  background: isVisible ? "var(--bg-card)" : "rgba(255, 255, 255, 0.05)",
                                  color: "var(--text-main)",
                                  boxShadow: isHighlighted ? "0 0 14px #f59e0b, 0 0 0 3px rgba(245, 158, 11, 0.4)" : "none",
                                  fontSize: isMobile ? "16px" : "11px",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  outline: "none",
                                  cursor: isVisible ? "text" : "not-allowed"
                                }}
                                title={isVisible ? "Click to edit Name" : "Condition not met"}
                              />
                            );
                          }

                          if (f.type === "signer_email") {
                            return (
                              <input
                                key={f.id}
                                id={`field-input-box-${f.id}`}
                                type="text"
                                value={isVisible ? signerEmail : val}
                                disabled={!isVisible}
                                readOnly={!isVisible}
                                tabIndex={isVisible ? tabIdx : -1}
                                onChange={(e) => isVisible && setSignerEmail(e.target.value)}
                                placeholder="Signer Email"
                                style={{
                                  ...style,
                                  border: isHighlighted
                                    ? "3px solid #f59e0b"
                                    : (isVisible ? signerEmail : val)
                                    ? "1.5px solid #10b981"
                                    : "2px dashed var(--primary-color)",
                                  background: isVisible ? "var(--bg-card)" : "rgba(255, 255, 255, 0.05)",
                                  color: "var(--text-main)",
                                  boxShadow: isHighlighted ? "0 0 14px #f59e0b, 0 0 0 3px rgba(245, 158, 11, 0.4)" : "none",
                                  fontSize: isMobile ? "16px" : "11px",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  outline: "none",
                                  cursor: isVisible ? "text" : "not-allowed"
                                }}
                                title={isVisible ? "Click to edit Email" : "Condition not met"}
                              />
                            );
                          }

                          if (f.type === "dob") {
                            return (
                              <input
                                key={f.id}
                                id={`field-input-box-${f.id}`}
                                type="date"
                                value={val}
                                disabled={!isVisible}
                                readOnly={!isVisible}
                                tabIndex={isVisible ? tabIdx : -1}
                                onChange={(e) => isVisible && handleInputChange(f.id, e.target.value)}
                                style={{
                                  ...style,
                                  background: isVisible ? "var(--bg-card)" : "rgba(255, 255, 255, 0.05)",
                                  color: "var(--text-main)",
                                  fontSize: isMobile ? "16px" : "11px",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  border: isHighlighted
                                    ? "3px solid #f59e0b"
                                    : val
                                    ? "1.5px solid #10b981"
                                    : f.required && isVisible
                                    ? "2.5px solid var(--primary-color)"
                                    : "1.5px solid var(--border-color)",
                                  outline: "none",
                                  height: `${mapping.height}px`,
                                  colorScheme: theme,
                                  cursor: isVisible ? "text" : "not-allowed",
                                  boxShadow: isHighlighted ? "0 0 14px #f59e0b, 0 0 0 3px rgba(245, 158, 11, 0.4)" : "none",
                                }}
                              />
                            );
                          }

                          if (f.type === "age") {
                            return (
                              <input
                                key={f.id}
                                id={`field-input-box-${f.id}`}
                                type="text"
                                value={val}
                                readOnly
                                disabled={!isVisible}
                                tabIndex={isVisible ? tabIdx : -1}
                                placeholder="Auto Age"
                                style={{
                                  ...style,
                                  background: "rgba(255, 255, 255, 0.05)",
                                  color: "var(--text-main)",
                                  fontSize: isMobile ? "16px" : "11px",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  border: isHighlighted
                                    ? "3px solid #f59e0b"
                                    : val
                                    ? "1.5px solid #10b981"
                                    : f.required && isVisible
                                    ? "2.5px solid var(--primary-color)"
                                    : "1.5px solid var(--border-color)",
                                  outline: "none",
                                  height: `${mapping.height}px`,
                                  cursor: "not-allowed",
                                  boxShadow: isHighlighted ? "0 0 14px #f59e0b, 0 0 0 3px rgba(245, 158, 11, 0.4)" : "none",
                                }}
                                title={isVisible ? "Calculated automatically based on Date of Birth" : "Condition not met"}
                              />
                            );
                          }

                          if (f.type === "todays_date") {
                            return (
                              <input
                                key={f.id}
                                id={`field-input-box-${f.id}`}
                                type="text"
                                value={val}
                                readOnly
                                disabled={!isVisible}
                                tabIndex={isVisible ? tabIdx : -1}
                                style={{
                                  ...style,
                                  background: "rgba(255, 255, 255, 0.05)",
                                  color: "var(--text-main)",
                                  fontSize: isMobile ? "16px" : "11px",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  border: isHighlighted
                                    ? "3px solid #f59e0b"
                                    : val
                                    ? "1.5px solid #10b981"
                                    : f.required && isVisible
                                    ? "2.5px solid var(--primary-color)"
                                    : "1.5px solid var(--border-color)",
                                  outline: "none",
                                  height: `${mapping.height}px`,
                                  cursor: "not-allowed",
                                  boxShadow: isHighlighted ? "0 0 14px #f59e0b, 0 0 0 3px rgba(245, 158, 11, 0.4)" : "none",
                                }}
                                title={isVisible ? "Today's Date" : "Condition not met"}
                              />
                            );
                          }

                          // Default: text, date, number inputs matching theme
                          return (
                            <input
                              key={f.id}
                              id={`field-input-box-${f.id}`}
                              type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
                              value={val}
                              disabled={!isVisible}
                              readOnly={!isVisible}
                              tabIndex={isVisible ? tabIdx : -1}
                              onChange={(e) => isVisible && handleInputChange(f.id, e.target.value)}
                              placeholder={isVisible ? (f.required ? `${f.label} *` : f.label) : "Condition not met"}
                              style={{
                                ...style,
                                background: isVisible ? "var(--bg-card)" : "rgba(255, 255, 255, 0.05)",
                                color: "var(--text-main)",
                                fontSize: isMobile ? "16px" : "11px",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                border: isHighlighted
                                  ? "3px solid #f59e0b"
                                  : val
                                  ? "1.5px solid #10b981"
                                  : f.required && isVisible
                                  ? "2.5px solid var(--primary-color)"
                                  : "1.5px solid var(--border-color)",
                                outline: "none",
                                height: `${mapping.height}px`,
                                colorScheme: theme,
                                cursor: isVisible ? "text" : "not-allowed",
                                boxShadow: isHighlighted ? "0 0 14px #f59e0b, 0 0 0 3px rgba(245, 158, 11, 0.4)" : "none",
                              }}
                            />
                          );
                        })}
                    </div>
                  </div>
                </div>
              ))}
              </div>
            )}
          </div>

          {/* Right Side: Signer Form Credentials & Validation checklist */}
          {!isMobile && (
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

                {/* Progress Checklist Bar (Only display list if NOT on mobile) */}
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

                  {/* Clickable checklist of remaining fields (Hidden on mobile screens to save layout space) */}
                  {!isMobile && remainingCount > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "16px" }}>
                      <div style={{ fontSize: "11px", fontWeight: "bold", color: "var(--text-muted)" }}>Remaining Fields Checklist:</div>
                      {sortedRequiredFields.map((f) => (
                        <div
                          key={f.id}
                          onClick={() => handleChecklistItemClick(f.id)}
                          style={{
                            background: "rgba(255, 255, 255, 0.03)",
                            border: "1px solid var(--border-color)",
                            borderRadius: "6px",
                            padding: "8px 12px",
                            fontSize: "12px",
                            cursor: "pointer",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            transition: "all var(--transition-fast)"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
                            e.currentTarget.style.borderColor = "var(--primary-color)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
                            e.currentTarget.style.borderColor = "var(--border-color)";
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{f.label}</span>
                          <span style={{ fontSize: "9px", padding: "2px 6px", borderRadius: "4px", background: "var(--primary-glow)", color: "var(--primary-color)", fontWeight: "bold" }}>
                            {f.required ? "Required *" : "Optional"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
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
          )}

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
              strokeColor="#000000"
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

      {/* Mobile-Only Document Completion Floating Navigation Bar */}
      {isMobile && (
        <div style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "var(--bg-glass)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderTop: "1px solid var(--border-color)",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 1000,
          boxShadow: "0 -4px 20px rgba(0,0,0,0.3)"
        }}>
          {submitError && (
            <div style={{
              position: "absolute",
              bottom: "75px",
              left: "16px",
              right: "16px",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: "bold",
              background: "rgba(239, 68, 68, 0.95)",
              padding: "10px",
              borderRadius: "6px",
              textAlign: "center",
              boxShadow: "0 4px 15px rgba(0,0,0,0.4)",
              zIndex: 1010
            }}>
              ⚠️ {submitError}
            </div>
          )}

          {remainingCount > 0 ? (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleNavigateChecklist("prev")}
                style={{ padding: "8px 12px", width: "auto", fontSize: "12px" }}
              >
                ← Prev
              </button>

              <div
                onClick={() => {
                  if (sortedRequiredFields[mobileActiveIdx]) {
                    handleChecklistItemClick(sortedRequiredFields[mobileActiveIdx].id);
                  }
                }}
                style={{ textAlign: "center", flex: 1, padding: "0 8px", cursor: "pointer" }}
              >
                <div style={{ fontSize: "10px", textTransform: "uppercase", color: "var(--primary-color)", fontWeight: "bold" }}>
                  Field {mobileActiveIdx + 1} of {remainingCount}
                </div>
                <div style={{ fontSize: "13px", fontWeight: "bold", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "200px", margin: "0 auto" }}>
                  {sortedRequiredFields[mobileActiveIdx]?.label || "Tap to view"} {sortedRequiredFields[mobileActiveIdx]?.required && "*"}
                </div>
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleNavigateChecklist("next")}
                style={{ padding: "8px 12px", width: "auto", fontSize: "12px" }}
              >
                Next →
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={isSubmitting}
              onClick={() => handleSubmit()}
              style={{ width: "100%", padding: "14px", fontSize: "15px", fontWeight: "bold", margin: 0 }}
            >
              {isSubmitting ? "Signing & Processing..." : "Sign Document"}
            </button>
          )}
        </div>
      )}
    </>
  );
}
