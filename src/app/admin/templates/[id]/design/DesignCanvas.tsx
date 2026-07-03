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
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [pdfjsLoaded, setPdfjsLoaded] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [saving, setSaving] = useState(false);

  // Mouse drag & resize states
  const [activeAction, setActiveAction] = useState<"moving" | "resizing" | null>(null);
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null);
  const dragStartCoords = useRef({
    mouseX: 0,
    mouseY: 0,
    fieldX: 0,
    fieldY: 0,
    fieldW: 0,
    fieldH: 0,
  });

  const renderedPagesRef = useRef<Set<number>>(new Set());

  // Load initial fields
  useEffect(() => {
    try {
      setFields(JSON.parse(initialFieldsJson) || []);
    } catch (e) {
      setFields([]);
    }
  }, [initialFieldsJson]);

  // Check if pdfjs is already loaded in window
  useEffect(() => {
    // @ts-ignore
    if (window.pdfjsLib || window["pdfjs-dist/build/pdf"]) {
      setPdfjsLoaded(true);
    }
  }, []);

  // PDF.js render pipeline
  useEffect(() => {
    if (!pdfjsLoaded) return;

    const renderPDF = async () => {
      try {
        setLoadingPdf(true);
        // @ts-ignore
        const pdfjsLib = window["pdfjs-dist/build/pdf"] || window.pdfjsLib;
        if (!pdfjsLib) {
          throw new Error("PDF.js library not loaded in window.");
        }
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/js/pdf.worker.min.js";

        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        setNumPages(pdf.numPages);
        setLoadingPdf(false);

        // Render page canvases sequentially
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (renderedPagesRef.current.has(pageNum)) continue;

          const page = await pdf.getPage(pageNum);
          const canvas = document.getElementById(`pdf-canvas-${pageNum - 1}`) as HTMLCanvasElement;
          if (!canvas) continue;

          const ctx = canvas.getContext("2d");
          if (!ctx) continue;

          // Scale 1.3 for crisp rendering
          const viewport = page.getViewport({ scale: 1.3 });
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          const overlay = document.getElementById(`pdf-overlay-${pageNum - 1}`);
          if (overlay) {
            overlay.style.width = `${viewport.width}px`;
            overlay.style.height = `${viewport.height}px`;
          }

          await page.render({ canvasContext: ctx, viewport }).promise;
          renderedPagesRef.current.add(pageNum);
        }
      } catch (err) {
        console.error("Error loading templates PDF:", err);
      } finally {
        setLoadingPdf(false);
      }
    };

    renderPDF();
  }, [pdfjsLoaded, pdfUrl]);

  // Mouse movements for drag repositioning & resizing
  useEffect(() => {
    if (!activeAction || !draggedFieldId) return;

    const handleMouseMove = (e: MouseEvent) => {
      const fieldIndex = fields.findIndex((f) => f.id === draggedFieldId);
      if (fieldIndex === -1) return;

      const field = fields[fieldIndex];
      const pageIndex = field.pdfMapping.page;
      const overlay = document.getElementById(`pdf-overlay-${pageIndex}`);
      if (!overlay) return;

      const rect = overlay.getBoundingClientRect();

      if (activeAction === "moving") {
        const deltaX = e.clientX - dragStartCoords.current.mouseX;
        const deltaY = e.clientY - dragStartCoords.current.mouseY;
        const deltaXPercent = (deltaX / rect.width) * 100;
        const deltaYPercent = (deltaY / rect.height) * 100;

        // Bounded boundaries
        const newX = Math.max(
          0,
          Math.min(
            100 - (field.pdfMapping.width / rect.width) * 100,
            dragStartCoords.current.fieldX + deltaXPercent
          )
        );
        const newY = Math.max(
          0,
          Math.min(
            100 - (field.pdfMapping.height / rect.height) * 100,
            dragStartCoords.current.fieldY + deltaYPercent
          )
        );

        setFields((prev) =>
          prev.map((f) =>
            f.id === draggedFieldId
              ? { ...f, pdfMapping: { ...f.pdfMapping, x: newX, y: newY } }
              : f
          )
        );
      } else if (activeAction === "resizing") {
        const deltaX = e.clientX - dragStartCoords.current.mouseX;
        const deltaY = e.clientY - dragStartCoords.current.mouseY;

        const newW = Math.max(18, dragStartCoords.current.fieldW + deltaX);
        const newH = Math.max(18, dragStartCoords.current.fieldH + deltaY);

        setFields((prev) =>
          prev.map((f) =>
            f.id === draggedFieldId
              ? { ...f, pdfMapping: { ...f.pdfMapping, width: newW, height: newH } }
              : f
          )
        );
      }
    };

    const handleMouseUp = () => {
      setActiveAction(null);
      setDraggedFieldId(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [activeAction, draggedFieldId, fields]);

  // Start Move Action
  const handleStartMove = (
    e: React.MouseEvent<HTMLDivElement>,
    field: FormField
  ) => {
    e.stopPropagation();
    setSelectedFieldId(field.id);
    setActiveAction("moving");
    setDraggedFieldId(field.id);
    dragStartCoords.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      fieldX: field.pdfMapping.x,
      fieldY: field.pdfMapping.y,
      fieldW: field.pdfMapping.width,
      fieldH: field.pdfMapping.height,
    };
  };

  // Start Resize Action
  const handleStartResize = (
    e: React.MouseEvent<HTMLDivElement>,
    field: FormField
  ) => {
    e.stopPropagation();
    setSelectedFieldId(field.id);
    setActiveAction("resizing");
    setDraggedFieldId(field.id);
    dragStartCoords.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      fieldX: field.pdfMapping.x,
      fieldY: field.pdfMapping.y,
      fieldW: field.pdfMapping.width,
      fieldH: field.pdfMapping.height,
    };
  };

  // HTML5 Drag-and-Drop Library Events
  const handleDragStart = (e: React.DragEvent, type: string) => {
    e.dataTransfer.setData("fieldType", type);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, pageIdx: number) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("fieldType");
    if (!type) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Generate variables identifiers
    const count = fields.filter((f) => f.type === type).length + 1;
    const cleanTypeName = type.charAt(0).toUpperCase() + type.slice(1);
    const label = `${cleanTypeName} Field ${count}`;
    const id = `${type}_${Date.now()}`;

    let defaultWidth = 150;
    let defaultHeight = 24;
    if (type === "signature") {
      defaultWidth = 150;
      defaultHeight = 45;
    } else if (type === "checkbox") {
      defaultWidth = 18;
      defaultHeight = 18;
    }

    const newField: FormField = {
      id,
      label,
      type: type as any,
      required: true,
      pdfMapping: {
        page: pageIdx,
        x,
        y,
        width: defaultWidth,
        height: defaultHeight,
      },
    };

    setFields((prev) => [...prev, newField]);
    setSelectedFieldId(id);
  };

  // Selected Field Properties Updates
  const selectedField = fields.find((f) => f.id === selectedFieldId) || null;

  const updateSelectedField = (updater: (field: FormField) => FormField) => {
    if (!selectedFieldId) return;
    setFields((prev) =>
      prev.map((f) => (f.id === selectedFieldId ? updater(f) : f))
    );
  };

  const handleDeleteField = (id: string) => {
    if (confirm("Delete this field configuration?")) {
      setFields((prev) => prev.filter((f) => f.id !== id));
      setSelectedFieldId(null);
    }
  };

  // Save layout to database
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

      alert("Visual schema template successfully saved!");
      router.push("/admin/templates");
      router.refresh();
    } catch (e: any) {
      alert("Error: " + e.message);
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
        
        {/* Left Side: Drag Library & Configuration Panels */}
        <div style={{ width: "360px", display: "flex", flexDirection: "column", gap: "20px", position: "sticky", top: "100px", maxHeight: "calc(100vh - 140px)", overflowY: "auto" }}>
          
          {/* Section 1: Drag-and-Drop Elements Library */}
          <div className="card-glass" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "bold" }}>Toolbox Library</h3>
            <p style={{ margin: 0, fontSize: "11px", color: "var(--text-muted)" }}>
              Drag elements onto the document pages to overlay variables.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, "text")}
                style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed var(--border-color)", padding: "10px", borderRadius: "6px", fontSize: "12px", textAlign: "center", cursor: "grab", fontWeight: 500 }}
              >
                📝 Text Input
              </div>
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, "date")}
                style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed var(--border-color)", padding: "10px", borderRadius: "6px", fontSize: "12px", textAlign: "center", cursor: "grab", fontWeight: 500 }}
              >
                📅 Date Picker
              </div>
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, "number")}
                style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed var(--border-color)", padding: "10px", borderRadius: "6px", fontSize: "12px", textAlign: "center", cursor: "grab", fontWeight: 500 }}
              >
                🔢 Number Input
              </div>
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, "checkbox")}
                style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed var(--border-color)", padding: "10px", borderRadius: "6px", fontSize: "12px", textAlign: "center", cursor: "grab", fontWeight: 500 }}
              >
                ☑️ Checkbox
              </div>
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, "signature")}
                style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed var(--border-color)", padding: "10px", borderRadius: "6px", fontSize: "12px", textAlign: "center", cursor: "grab", fontWeight: 500, gridColumn: "span 2" }}
              >
                ✍️ Signature Canvas
              </div>
            </div>
          </div>

          {/* Section 2: Selected Field Properties Configuration */}
          <div className="card-glass" style={{ padding: "16px", minHeight: "180px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "bold" }}>Properties Editor</h3>
            
            {selectedField ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: "11px" }}>Display Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={selectedField.label}
                    onChange={(e) => updateSelectedField((f) => ({ ...f, label: e.target.value }))}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: "11px" }}>System Variable ID</label>
                  <input
                    type="text"
                    className="form-input"
                    value={selectedField.id}
                    onChange={(e) => {
                      const cleanId = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
                      updateSelectedField((f) => ({ ...f, id: cleanId }));
                      setSelectedFieldId(cleanId);
                    }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: "11px" }}>Input Type</label>
                    <select
                      className="form-input"
                      value={selectedField.type}
                      onChange={(e) => updateSelectedField((f) => ({ ...f, type: e.target.value as any }))}
                      style={{ background: "rgba(0,0,0,0.4)", height: "36px", padding: "4px 8px" }}
                    >
                      <option value="text">Text Input</option>
                      <option value="date">Date Picker</option>
                      <option value="number">Number</option>
                      <option value="checkbox">Checkbox</option>
                      <option value="signature">Signature</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: "11px" }}>Validation</label>
                    <select
                      className="form-input"
                      value={String(selectedField.required)}
                      onChange={(e) => updateSelectedField((f) => ({ ...f, required: e.target.value === "true" }))}
                      style={{ background: "rgba(0,0,0,0.4)", height: "36px", padding: "4px 8px" }}
                    >
                      <option value="true">Required</option>
                      <option value="false">Optional</option>
                    </select>
                  </div>
                </div>

                {/* Conditional Logic Section */}
                <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "12px", marginTop: "4px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={!!selectedField.conditional}
                      onChange={(e) => {
                        updateSelectedField((f) => {
                          if (e.target.checked) {
                            return {
                              ...f,
                              conditional: { field: "", operator: "equals", value: "" },
                            };
                          } else {
                            const { conditional, ...rest } = f;
                            return rest as FormField;
                          }
                        });
                      }}
                      style={{ accentColor: "var(--primary-color)" }}
                    />
                    Enable Conditional display
                  </label>

                  {selectedField.conditional && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", background: "rgba(0,0,0,0.2)", padding: "10px", borderRadius: "6px", border: "1px solid var(--border-color)", marginTop: "8px" }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: "10px" }}>Show if other Field ID</label>
                        <select
                          className="form-input"
                          value={selectedField.conditional.field}
                          onChange={(e) =>
                            updateSelectedField((f) => ({
                              ...f,
                              conditional: { ...f.conditional!, field: e.target.value },
                            }))
                          }
                          style={{ background: "rgba(0,0,0,0.4)" }}
                        >
                          <option value="">-- Choose Field --</option>
                          {fields
                            .filter((f) => f.id !== selectedFieldId)
                            .map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.label} ({f.id})
                              </option>
                            ))}
                        </select>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: "10px" }}>Operator</label>
                          <select
                            className="form-input"
                            value={selectedField.conditional.operator}
                            onChange={(e) =>
                              updateSelectedField((f) => ({
                                ...f,
                                conditional: { ...f.conditional!, operator: e.target.value as any },
                              }))
                            }
                            style={{ background: "rgba(0,0,0,0.4)" }}
                          >
                            <option value="equals">Equals</option>
                            <option value="age_less_than">Age &lt;</option>
                            <option value="checked">Is Checked</option>
                          </select>
                        </div>

                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: "10px" }}>Value</label>
                          <input
                            type="text"
                            className="form-input"
                            disabled={selectedField.conditional.operator === "checked"}
                            value={selectedField.conditional.value || ""}
                            onChange={(e) =>
                              updateSelectedField((f) => ({
                                ...f,
                                conditional: { ...f.conditional!, value: e.target.value },
                              }))
                            }
                            placeholder="e.g. 18"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleDeleteField(selectedFieldId!)}
                  className="btn btn-danger"
                  style={{ width: "100%", padding: "8px", fontSize: "12px", marginTop: "4px" }}
                >
                  Remove Variable
                </button>
              </div>
            ) : (
              <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "12px", padding: "24px 0", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                Click a placed field on the document to edit its details here.
              </div>
            )}
          </div>

          {/* Section 3: Placed elements list & Action triggers */}
          <div className="card-glass" style={{ padding: "16px", flex: 1, display: "flex", flexDirection: "column", gap: "16px", minHeight: "200px" }}>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "bold" }}>Placed Variables ({fields.length})</h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1, overflowY: "auto", maxHeight: "250px" }}>
              {fields.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "12px", padding: "10px" }}>
                  No variables placed on this document yet.
                </div>
              ) : (
                fields.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => setSelectedFieldId(f.id)}
                    style={{
                      background: f.id === selectedFieldId ? "var(--primary-glow)" : "rgba(255,255,255,0.01)",
                      border: f.id === selectedFieldId ? "1px solid var(--primary-color)" : "1px solid var(--border-color)",
                      borderRadius: "6px",
                      padding: "8px 12px",
                      fontSize: "12px",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{f.label}</div>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                        ID: {f.id} | Page {f.pdfMapping.page + 1}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={handleSaveSchema}
              disabled={saving}
              className="btn btn-primary"
              style={{ width: "100%", padding: "14px", marginTop: "auto" }}
            >
              {saving ? "Saving Changes..." : "Save Fields Schema"}
            </button>
          </div>

        </div>

        {/* Right Side: Interactive PDF Canvas Sheets overlay */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "32px", alignItems: "center" }}>
          {loadingPdf && (
            <div className="card-glass" style={{ width: "100%", textAlign: "center", padding: "60px" }}>
              Loading base template layout...
            </div>
          )}

          {Array.from({ length: numPages }).map((_, pageIdx) => (
            <div
              key={pageIdx}
              id={`pdf-overlay-${pageIdx}`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, pageIdx)}
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
              
              {/* Placement & Interactivity Overlay Container */}
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
                {/* Placed Fields Overlay Cards */}
                {fields
                  .filter((f) => f.pdfMapping.page === pageIdx)
                  .map((f) => {
                    const isSelected = f.id === selectedFieldId;
                    
                    return (
                      <div
                        key={f.id}
                        onMouseDown={(e) => handleStartMove(e, f)}
                        style={{
                          position: "absolute",
                          left: `${f.pdfMapping.x}%`,
                          top: `${f.pdfMapping.y}%`,
                          width: `${f.pdfMapping.width}px`,
                          height: `${f.pdfMapping.height}px`,
                          border: isSelected ? "2px solid var(--primary-color)" : "1px solid rgba(255,255,255,0.4)",
                          background: isSelected ? "var(--primary-glow)" : "rgba(0, 0, 0, 0.6)",
                          borderRadius: "4px",
                          color: "white",
                          fontSize: "10px",
                          fontWeight: "bold",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "2px 6px",
                          zIndex: isSelected ? 30 : 20,
                          cursor: "move",
                          userSelect: "none",
                          boxSizing: "border-box"
                        }}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: "6px" }}>
                          {f.label}
                        </span>

                        {/* Drag Resize Corner Handle */}
                        <div
                          onMouseDown={(e) => handleStartResize(e, f)}
                          style={{
                            position: "absolute",
                            bottom: 0,
                            right: 0,
                            width: "8px",
                            height: "8px",
                            background: isSelected ? "var(--primary-color)" : "rgba(255,255,255,0.5)",
                            cursor: "se-resize",
                            zIndex: 40,
                            borderRadius: "1px"
                          }}
                        />
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>

      </div>
    </>
  );
}
