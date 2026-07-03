"use client";

import React, { useState, useEffect, useRef } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";

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
  type: "text" | "date" | "number" | "checkbox" | "signature";
  required: boolean;
  pdfMapping: FieldMapping;
  conditional?: {
    field: string;
    operator: "equals" | "age_less_than" | "checked";
    value: any;
  };
}

interface DesignCanvasProps {
  templateId: string;
  pdfUrl: string;
  initialFieldsJson: string;
  templateTitle: string;
}

export default function DesignCanvas({
  templateId,
  pdfUrl,
  initialFieldsJson,
  templateTitle,
}: DesignCanvasProps) {
  const router = useRouter();
  
  const [fields, setFields] = useState<FormField[]>([]);
  const [pdfjsLoaded, setPdfjsLoaded] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [loadingPdf, setLoadingPdf] = useState(true);
  
  // Dialog modal states
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  
  // Field Form States
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldId, setFieldId] = useState("");
  const [fieldType, setFieldType] = useState<"text" | "date" | "number" | "checkbox" | "signature">("text");
  const [fieldRequired, setFieldRequired] = useState(true);
  const [fieldWidth, setFieldWidth] = useState(150);
  const [fieldHeight, setFieldHeight] = useState(20);
  
  // Conditional Logic States
  const [hasConditional, setHasConditional] = useState(false);
  const [condField, setCondField] = useState("");
  const [condOperator, setCondOperator] = useState<"equals" | "age_less_than" | "checked">("equals");
  const [condValue, setCondValue] = useState("");

  const [clickCoords, setClickCoords] = useState<{ page: number; x: number; y: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderedPagesRef = useRef<Set<number>>(new Set());

  // Load initial fields schema
  useEffect(() => {
    try {
      setFields(JSON.parse(initialFieldsJson) || []);
    } catch (e) {
      setFields([]);
    }
  }, [initialFieldsJson]);

  // Check if PDF.js is already loaded in window to prevent stuck loading state
  useEffect(() => {
    // @ts-ignore
    if (window.pdfjsLib || window["pdfjs-dist/build/pdf"]) {
      setPdfjsLoaded(true);
    }
  }, []);

  // Sync ID to Label as user types
  useEffect(() => {
    if (!isEditing && fieldLabel) {
      setFieldId(
        fieldLabel
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, "")
          .replace(/\s+/g, "_")
          .substring(0, 24)
      );
    }
  }, [fieldLabel, isEditing]);

  // Adjust default size when Type changes
  useEffect(() => {
    if (!isEditing) {
      if (fieldType === "signature") {
        setFieldWidth(150);
        setFieldHeight(45);
      } else if (fieldType === "checkbox") {
        setFieldWidth(18);
        setFieldHeight(18);
      } else {
        setFieldWidth(150);
        setFieldHeight(20);
      }
    }
  }, [fieldType, isEditing]);

  // Render PDF pages on canvas elements
  useEffect(() => {
    if (!pdfjsLoaded) return;
    
    const renderPDF = async () => {
      try {
        setLoadingPdf(true);
        // @ts-ignore
        const pdfjsLib = window["pdfjs-dist/build/pdf"] || window.pdfjsLib;
        if (!pdfjsLib) {
          throw new Error("PDF.js library not found in window object.");
        }
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/js/pdf.worker.min.js";

        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        setNumPages(pdf.numPages);
        setLoadingPdf(false);

        // Render each page canvas
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (renderedPagesRef.current.has(pageNum)) continue;

          const page = await pdf.getPage(pageNum);
          const canvas = document.getElementById(`pdf-canvas-${pageNum - 1}`) as HTMLCanvasElement;
          if (!canvas) continue;

          const ctx = canvas.getContext("2d");
          if (!ctx) continue;

          const viewport = page.getViewport({ scale: 1.3 });
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          // Make container match canvas height
          const overlay = document.getElementById(`pdf-overlay-${pageNum - 1}`);
          if (overlay) {
            overlay.style.width = `${viewport.width}px`;
            overlay.style.height = `${viewport.height}px`;
          }

          await page.render({ canvasContext: ctx, viewport }).promise;
          renderedPagesRef.current.add(pageNum);
        }
      } catch (err) {
        console.error("Error rendering designer PDF:", err);
      } finally {
        setLoadingPdf(false);
      }
    };

    renderPDF();
  }, [pdfjsLoaded, pdfUrl]);

  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>, pageIndex: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setIsEditing(false);
    setEditIndex(null);
    setFieldLabel("");
    setFieldId("");
    setFieldType("text");
    setFieldRequired(true);
    setHasConditional(false);
    setCondField("");
    setCondOperator("equals");
    setCondValue("");
    
    setClickCoords({ page: pageIndex, x, y });
    setShowModal(true);
  };

  const handleEditField = (index: number, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent adding new field click
    const f = fields[index];
    
    setIsEditing(true);
    setEditIndex(index);
    setFieldLabel(f.label);
    setFieldId(f.id);
    setFieldType(f.type);
    setFieldRequired(f.required);
    setFieldWidth(f.pdfMapping.width);
    setFieldHeight(f.pdfMapping.height);
    
    if (f.conditional) {
      setHasConditional(true);
      setCondField(f.conditional.field);
      setCondOperator(f.conditional.operator);
      setCondValue(f.conditional.value);
    } else {
      setHasConditional(false);
      setCondField("");
      setCondOperator("equals");
      setCondValue("");
    }

    setClickCoords({
      page: f.pdfMapping.page,
      x: f.pdfMapping.x,
      y: f.pdfMapping.y,
    });
    setShowModal(true);
  };

  const handleDeleteField = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this field?")) {
      setFields((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleSaveField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldId.trim()) return;

    // Check duplicate ID
    const duplicate = fields.some((f, idx) => f.id === fieldId && idx !== editIndex);
    if (duplicate) {
      alert("A field with this variable ID already exists in the template.");
      return;
    }

    const newField: FormField = {
      id: fieldId,
      label: fieldLabel,
      type: fieldType,
      required: fieldRequired,
      pdfMapping: {
        page: clickCoords!.page,
        x: clickCoords!.x,
        y: clickCoords!.y,
        width: Number(fieldWidth),
        height: Number(fieldHeight),
      },
    };

    if (hasConditional && condField) {
      newField.conditional = {
        field: condField,
        operator: condOperator,
        value: condValue,
      };
    }

    if (isEditing && editIndex !== null) {
      setFields((prev) => prev.map((f, i) => (i === editIndex ? newField : f)));
    } else {
      setFields((prev) => [...prev, newField]);
    }

    setShowModal(false);
  };

  const handleSaveSchema = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/templates/${templateId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fieldsJson: JSON.stringify(fields),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "Failed to save fields schema.");
      }

      alert("Visual schema saved successfully!");
      router.push("/admin/templates");
      router.refresh();
    } catch (e: any) {
      alert("Error saving: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Script
        src="/js/pdf.min.js"
        onLoad={() => setPdfjsLoaded(true)}
      />

      <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>
        
        {/* Left Side: Placed Fields Index Panel */}
        <div className="card-glass" style={{ width: "320px", position: "sticky", top: "100px", maxHeight: "calc(100vh - 160px)", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <h3>Mapped Elements</h3>
            <p style={{ fontSize: "12px", margin: 0 }}>List of variables overlaid on this PDF.</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1, overflowY: "auto" }}>
            {fields.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "13px", padding: "20px" }}>
                No variables placed yet. Click on the document pages to add fields.
              </div>
            ) : (
              fields.map((f, i) => (
                <div
                  key={f.id}
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    padding: "10px",
                    fontSize: "13px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{f.label}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      id: {f.id} | Page {f.pdfMapping.page + 1}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      onClick={(e) => handleEditField(i, e)}
                      className="btn btn-secondary"
                      style={{ padding: "4px 8px", fontSize: "11px", width: "auto" }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => handleDeleteField(i, e)}
                      className="btn btn-danger"
                      style={{ padding: "4px 8px", fontSize: "11px", width: "auto" }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            onClick={handleSaveSchema}
            disabled={saving}
            className="btn btn-primary"
            style={{ width: "100%", padding: "14px" }}
          >
            {saving ? "Saving Changes..." : "Save Fields Schema"}
          </button>
        </div>

        {/* Right Side: PDF Viewer Canvas Sheets */}
        <div ref={containerRef} style={{ flex: 1, display: "flex", flexDirection: "column", gap: "32px", alignItems: "center" }}>
          {loadingPdf && (
            <div className="card-glass" style={{ width: "100%", textAlign: "center", padding: "40px" }}>
              Loading PDF layout templates...
            </div>
          )}

          {Array.from({ length: numPages }).map((_, pageIdx) => (
            <div
              key={pageIdx}
              id={`pdf-overlay-${pageIdx}`}
              style={{
                position: "relative",
                border: "1px solid var(--border-color)",
                boxShadow: "var(--shadow-main)",
                borderRadius: "8px",
                overflow: "hidden",
                background: "#000",
              }}
            >
              <canvas id={`pdf-canvas-${pageIdx}`} style={{ display: "block", width: "100%", height: "100%" }} />
              
              {/* Overlay for clicking & placing fields */}
              <div
                onClick={(e) => handlePageClick(e, pageIdx)}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  cursor: "cell",
                  zIndex: 10,
                }}
              >
                {/* Render placed fields boxes */}
                {fields
                  .filter((f) => f.pdfMapping.page === pageIdx)
                  .map((f, idx) => {
                    const originalIndex = fields.findIndex((orig) => orig.id === f.id);
                    
                    return (
                      <div
                        key={f.id}
                        onClick={(e) => handleEditField(originalIndex, e)}
                        style={{
                          position: "absolute",
                          left: `${f.pdfMapping.x}%`,
                          top: `${f.pdfMapping.y}%`,
                          width: `${f.pdfMapping.width}px`,
                          height: `${f.pdfMapping.height}px`,
                          border: "2px solid var(--primary-color)",
                          background: "var(--primary-glow)",
                          borderRadius: "4px",
                          color: "white",
                          fontSize: "10px",
                          fontWeight: "bold",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                          padding: "2px",
                          zIndex: 20,
                          cursor: "pointer",
                        }}
                      >
                        {f.label}
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Field Properties Dialog Modal */}
      {showModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div className="card-glass" style={{ width: "100%", maxWidth: "500px" }}>
            <h2 style={{ marginBottom: "16px" }}>{isEditing ? "Edit Mapped Field" : "Map New Field"}</h2>
            
            <form onSubmit={handleSaveField} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group">
                <label className="form-label">Display Field Label</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={fieldLabel}
                  onChange={(e) => setFieldLabel(e.target.value)}
                  placeholder="e.g. Parental Signature"
                />
              </div>

              <div className="form-group">
                <label className="form-label">System Variable ID (cased)</label>
                <input
                  type="text"
                  required
                  disabled={isEditing}
                  className="form-input"
                  value={fieldId}
                  onChange={(e) => setFieldId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="parental_signature"
                />
              </div>

              <div className="dashboard-grid" style={{ gap: "12px" }}>
                <div className="form-group">
                  <label className="form-label">Input Type</label>
                  <select
                    className="form-input"
                    value={fieldType}
                    onChange={(e) => setFieldType(e.target.value as any)}
                    style={{ background: "rgba(0,0,0,0.4)" }}
                  >
                    <option value="text">Text Input</option>
                    <option value="date">Date picker</option>
                    <option value="number">Number input</option>
                    <option value="checkbox">Agree Checkbox</option>
                    <option value="signature">Signature Canvas</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Validation</label>
                  <select
                    className="form-input"
                    value={String(fieldRequired)}
                    onChange={(e) => setFieldRequired(e.target.value === "true")}
                    style={{ background: "rgba(0,0,0,0.4)" }}
                  >
                    <option value="true">Required Field</option>
                    <option value="false">Optional Field</option>
                  </select>
                </div>
              </div>

              <div className="dashboard-grid" style={{ gap: "12px" }}>
                <div className="form-group">
                  <label className="form-label">PDF Overlay Width (px)</label>
                  <input
                    type="number"
                    required
                    className="form-input"
                    value={fieldWidth}
                    onChange={(e) => setFieldWidth(Number(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">PDF Overlay Height (px)</label>
                  <input
                    type="number"
                    required
                    className="form-input"
                    value={fieldHeight}
                    onChange={(e) => setFieldHeight(Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Conditional Display Rules */}
              <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "12px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "bold" }}>
                  <input
                    type="checkbox"
                    checked={hasConditional}
                    onChange={(e) => setHasConditional(e.target.checked)}
                    style={{ width: "16px", height: "16px", accentColor: "var(--primary-color)" }}
                  />
                  Enable Conditional Display logic
                </label>

                {hasConditional && (
                  <div style={{ marginTop: "12px", background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-color)", borderRadius: "6px", padding: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: "12px" }}>Show if other variable ID</label>
                      <input
                        type="text"
                        required={hasConditional}
                        className="form-input"
                        value={condField}
                        onChange={(e) => setCondField(e.target.value)}
                        placeholder="e.g. dob"
                      />
                    </div>

                    <div className="dashboard-grid" style={{ gap: "12px" }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: "12px" }}>Operator</label>
                        <select
                          className="form-input"
                          value={condOperator}
                          onChange={(e) => setCondOperator(e.target.value as any)}
                          style={{ background: "rgba(0,0,0,0.4)" }}
                        >
                          <option value="age_less_than">Age is less than</option>
                          <option value="equals">Value equals</option>
                          <option value="checked">Is checked (yes/no)</option>
                        </select>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: "12px" }}>Target Value</label>
                        <input
                          type="text"
                          required={hasConditional && condOperator !== "checked"}
                          disabled={condOperator === "checked"}
                          className="form-input"
                          value={condValue}
                          onChange={(e) => setCondValue(e.target.value)}
                          placeholder="e.g. 18"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", borderTop: "1px solid var(--border-color)", paddingTop: "16px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                  style={{ width: "auto" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: "auto" }}
                >
                  Confirm Field Mapping
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
