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
  type: "text" | "date" | "number" | "checkbox" | "signature" | "signer_name" | "signer_email" | "dob" | "age" | "todays_date" | "custom_email";
  required: boolean;
  pdfMapping: FieldMapping;
  conditional?: {
    field: string;
    operator: "equals" | "greater_than" | "less_than" | "checked" | "is_checked" | "age_less_than";
    value: any;
    fallbackValue?: string;
  };
  linkedFieldId?: string;
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
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [copiedField, setCopiedField] = useState<FormField | null>(null);
  const [pdfjsLoaded, setPdfjsLoaded] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [saving, setSaving] = useState(false);

  // Custom inline dialog states (avoiding system native popups)
  const [alertState, setAlertState] = useState<{ message: string; title?: string } | null>(null);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

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

  // Keyboard Actions Listener (Copy/Paste, Delete, Arrow moves)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcut actions if typing inside an input field
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          activeEl.getAttribute("contenteditable") === "true")
      ) {
        return;
      }

      // 1. Delete element (Delete/Backspace keys)
      if (selectedFieldId && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        handleDeleteField(selectedFieldId);
        return;
      }

      // 2. Copy element (Ctrl/Cmd + C)
      if (selectedFieldId && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        const field = fields.find((f) => f.id === selectedFieldId);
        if (field) {
          e.preventDefault();
          setCopiedField(field);
        }
        return;
      }

      // 3. Paste element (Ctrl/Cmd + V)
      if (copiedField && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        e.preventDefault();

        const type = copiedField.type;
        const count = fields.filter((f) => f.type === type).length + 1;
        let baseId = `${type}_${count}`;
        let idx = count;
        while (fields.some((f) => f.id === baseId)) {
          idx++;
          baseId = `${type}_${idx}`;
        }
        const newId = baseId;
        const newLabel = `${copiedField.label.replace(/ Copy/g, "")} Copy`;

        const newField: FormField = {
          ...copiedField,
          id: newId,
          label: newLabel,
          pdfMapping: {
            ...copiedField.pdfMapping,
            x: Math.min(95, copiedField.pdfMapping.x + 3),
            y: Math.min(95, copiedField.pdfMapping.y + 3),
          },
        };

        setFields((prev) => [...prev, newField]);
        setSelectedFieldId(newId);
        return;
      }

      // 4. Move element with Arrow keys
      if (selectedFieldId && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 3.0 : 0.5;

        setFields((prev) =>
          prev.map((f) => {
            if (f.id !== selectedFieldId) return f;
            let newX = f.pdfMapping.x;
            let newY = f.pdfMapping.y;

            if (e.key === "ArrowUp") newY = Math.max(0, f.pdfMapping.y - step);
            if (e.key === "ArrowDown") newY = Math.min(100, f.pdfMapping.y + step);
            if (e.key === "ArrowLeft") newX = Math.max(0, f.pdfMapping.x - step);
            if (e.key === "ArrowRight") newX = Math.min(100, f.pdfMapping.x + step);

            return {
              ...f,
              pdfMapping: {
                ...f.pdfMapping,
                x: newX,
                y: newY,
              },
            };
          })
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedFieldId, fields, copiedField]);

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

    // Generate variables identifiers with user-friendly incremented suffix
    const count = fields.filter((f) => f.type === type).length + 1;
    let baseId = `${type}_${count}`;
    let idx = count;
    while (fields.some((f) => f.id === baseId)) {
      idx++;
      baseId = `${type}_${idx}`;
    }
    const id = baseId;

    let cleanTypeName = type.replace(/_/g, " ");
    if (type === "dob") {
      cleanTypeName = "Date of Birth";
    } else if (type === "todays_date") {
      cleanTypeName = "Today's Date";
    } else if (type === "age") {
      cleanTypeName = "Age";
    } else if (type === "custom_email") {
      cleanTypeName = "Custom Email";
    } else {
      cleanTypeName = cleanTypeName.charAt(0).toUpperCase() + cleanTypeName.slice(1);
    }
    const label = `${cleanTypeName} Field ${idx}`;

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

  const updateEditingField = (updater: (field: FormField) => FormField) => {
    setEditingField((prev) => (prev ? updater({ ...prev }) : null));
  };

  const handleSaveProperties = () => {
    if (!editingField || !selectedFieldId) return;

    // Validate ID
    const cleanId = editingField.id.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!cleanId) {
      setAlertState({
        title: "Invalid ID",
        message: "Variable ID cannot be empty."
      });
      return;
    }

    // Check uniqueness
    const isDuplicate = fields.some((f) => f.id === cleanId && f.id !== selectedFieldId);
    if (isDuplicate) {
      setAlertState({
        title: "Duplicate ID",
        message: `A variable with ID "${cleanId}" already exists. Please enter a unique ID.`
      });
      return;
    }

    const isSignerType = editingField.type === "signer_name" || editingField.type === "signer_email";
    const hasCustomLink = !isSignerType && editingField.linkedFieldId;

    // Update fields array
    setFields((prev) =>
      prev.map((f) => {
        // 1. Target field being directly edited
        if (f.id === selectedFieldId) {
          return { ...editingField, id: cleanId };
        }

        // 2. Signer name/email fields always sync globally by type
        if (isSignerType && f.type === editingField.type) {
          return {
            ...f,
            label: editingField.label,
            required: editingField.required,
            conditional: editingField.conditional,
          };
        }

        // 3. Custom linked field copies the properties and links back
        if (hasCustomLink && f.id === editingField.linkedFieldId) {
          return {
            ...f,
            label: editingField.label,
            required: editingField.required,
            conditional: editingField.conditional,
            linkedFieldId: cleanId, // link back to the edited field
          };
        }

        // 4. Clean up old link relations if it was linked to the edited field but now the link is cleared/pointing elsewhere
        if (!isSignerType && f.linkedFieldId === selectedFieldId) {
          if (editingField.linkedFieldId !== f.id) {
            return { ...f, linkedFieldId: undefined };
          } else {
            // Pointing to edited field's new cleanId
            return {
              ...f,
              label: editingField.label,
              required: editingField.required,
              conditional: editingField.conditional,
              linkedFieldId: cleanId,
            };
          }
        }

        return f;
      })
    );

    setSelectedFieldId(cleanId);
    setEditingField(null);
  };

  const handleDeleteField = (id: string) => {
    setConfirmState({
      title: "Delete Variable",
      message: `Are you sure you want to remove the variable ID "${id}" from this template mapping?`,
      onConfirm: () => {
        setFields((prev) => prev.filter((f) => f.id !== id));
        setSelectedFieldId(null);
      },
    });
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

      setAlertState({
        title: "Success",
        message: "Visual schema template successfully saved!",
      });
      // Redirect handled cleanly after alert close or router push
      router.push("/admin/templates");
      router.refresh();
    } catch (e: any) {
      setAlertState({
        title: "Error Saving",
        message: e.message || "Failed to save visual fields configuration.",
      });
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
        <div style={{ width: "360px", minWidth: "360px", maxWidth: "360px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "20px", position: "sticky", top: "100px", maxHeight: "calc(100vh - 140px)", overflowY: "auto", overflowX: "hidden" }}>
          
          {/* Section 1: Drag-and-Drop Elements Library */}
          <div className="card-glass" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px", flexShrink: 0 }}>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "bold" }}>Toolbox Library</h3>
            <p style={{ margin: 0, fontSize: "11px", color: "var(--text-muted)" }}>
              Drag elements onto the document pages to overlay variables.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.05em", marginTop: "4px" }}>
                Standard Fields
              </div>
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
                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, "dob")}
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed var(--border-color)", padding: "10px", borderRadius: "6px", fontSize: "12px", textAlign: "center", cursor: "grab", fontWeight: 500, gridColumn: "span 2" }}
                >
                  👶 Date of Birth
                </div>
              </div>

              <div style={{ fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.05em", borderTop: "1px solid var(--border-color)", paddingTop: "10px", marginTop: "4px" }}>
                Calculated Fields
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, "age")}
                  style={{ background: "rgba(255,255,255,0.03)", border: "1.5px dashed #3b82f6", padding: "10px", borderRadius: "6px", fontSize: "12px", textAlign: "center", cursor: "grab", fontWeight: 600 }}
                  title="Calculated automatically based on Date of Birth field input"
                >
                  🧮 Age (Calculated)
                </div>
                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, "todays_date")}
                  style={{ background: "rgba(255,255,255,0.03)", border: "1.5px dashed #3b82f6", padding: "10px", borderRadius: "6px", fontSize: "12px", textAlign: "center", cursor: "grab", fontWeight: 600 }}
                  title="Calculated automatically to today's date"
                >
                  📅 Today's Date
                </div>
              </div>

              <div style={{ fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.05em", borderTop: "1px solid var(--border-color)", paddingTop: "10px", marginTop: "4px" }}>
                Signer Identity fields
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, "signer_name")}
                  style={{ background: "rgba(var(--primary-rgb), 0.05)", border: "1.5px dashed var(--primary-color)", padding: "10px", borderRadius: "6px", fontSize: "12px", textAlign: "center", cursor: "grab", fontWeight: 600, gridColumn: "span 2" }}
                >
                  👤 Signer Name
                </div>
                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, "signer_email")}
                  style={{ background: "rgba(var(--primary-rgb), 0.05)", border: "1.5px dashed var(--primary-color)", padding: "10px", borderRadius: "6px", fontSize: "12px", textAlign: "center", cursor: "grab", fontWeight: 600, gridColumn: "span 2" }}
                >
                  ✉️ Signer Email
                </div>
                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, "custom_email")}
                  style={{ background: "rgba(var(--primary-rgb), 0.05)", border: "1.5px dashed var(--primary-color)", padding: "10px", borderRadius: "6px", fontSize: "12px", textAlign: "center", cursor: "grab", fontWeight: 600, gridColumn: "span 2" }}
                >
                  ✉️ Custom Email (e.g. Parent)
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Selected Field Properties Configuration Summary */}
          <div className="card-glass" style={{ padding: "16px", minHeight: "120px", display: "flex", flexDirection: "column", gap: "12px", flexShrink: 0 }}>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "bold" }}>Properties Editor</h3>
            
            {selectedField ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ padding: "10px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-color)", borderRadius: "6px" }}>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                    Selected Variable
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: "bold", color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {selectedField.label}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                    ID: <code style={{ color: "var(--primary-color)", fontWeight: "bold" }}>{selectedField.id}</code>
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    Type: <span style={{ color: "var(--text-main)" }}>{selectedField.type.replace(/_/g, " ")}</span>
                  </div>
                </div>
                
                <button
                  onClick={() => setEditingField(selectedField)}
                  className="btn btn-primary"
                  style={{ width: "100%", padding: "10px", fontSize: "12px" }}
                >
                  ⚙️ Edit Properties
                </button>
                
                <button
                  onClick={() => handleDeleteField(selectedField.id)}
                  className="btn btn-danger"
                  style={{ width: "100%", padding: "10px", fontSize: "12px" }}
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
                      alignItems: "center",
                      width: "100%",
                      boxSizing: "border-box"
                    }}
                  >
                    <div style={{ overflow: "hidden", marginRight: "8px" }}>
                      <div style={{ fontWeight: 600, color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {f.label} {f.required && <span style={{ color: "#ef4444" }}>*</span>}
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                        ID: {f.id} | Page {f.pdfMapping.page + 1}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFieldId(f.id);
                          setEditingField(f);
                        }}
                        title="Edit Properties"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          padding: "4px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "14px"
                        }}
                      >
                        ⚙️
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteField(f.id);
                        }}
                        title="Delete Field"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          padding: "4px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "14px"
                        }}
                      >
                        🗑️
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
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingField(f);
                        }}
                        style={{
                          position: "absolute",
                          left: `${f.pdfMapping.x}%`,
                          top: `${f.pdfMapping.y}%`,
                          width: `${f.pdfMapping.width}px`,
                          height: `${f.pdfMapping.height}px`,
                          border: isSelected 
                            ? "2px solid var(--primary-color)" 
                            : (f.type === "age" || f.type === "todays_date" 
                              ? "1.5px dashed var(--primary-color)" 
                              : "1px solid var(--text-muted)"),
                          background: f.type === "age" || f.type === "todays_date" 
                            ? "rgba(59, 130, 246, 0.05)" 
                            : "var(--bg-glass)",
                          borderRadius: "4px",
                          color: "var(--text-main)",
                          fontSize: "10px",
                          fontWeight: "bold",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "2px 6px",
                          zIndex: isSelected ? 30 : 20,
                          cursor: "move",
                          userSelect: "none",
                          boxSizing: "border-box",
                          boxShadow: isSelected ? "0 0 8px var(--primary-color)" : "none"
                        }}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: "6px" }}>
                          {f.label}
                          {(f.type === "age" || f.type === "todays_date") && (
                            <span style={{ color: "#3b82f6", fontSize: "9px", marginLeft: "4px", fontStyle: "italic" }}>
                              (Auto)
                            </span>
                          )}
                          {f.required && <span style={{ color: "#ef4444", marginLeft: "2px" }}>*</span>}
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
                            background: isSelected ? "var(--primary-color)" : "var(--text-muted)",
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

      {/* Properties Editor Modal */}
      {editingField && (
        <div 
          style={{ 
            position: "fixed", 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: "rgba(0,0,0,0.8)", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            zIndex: 5000,
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)"
          }}
        >
          <div 
            className="card-glass" 
            style={{ 
              width: "500px", 
              maxWidth: "95%", 
              padding: "24px", 
              display: "flex", 
              flexDirection: "column", 
              gap: "16px", 
              maxHeight: "90vh", 
              overflowY: "auto" 
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "bold" }}>Edit Variable Properties</h3>
              <button 
                onClick={() => setEditingField(null)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: "20px", cursor: "pointer", padding: "4px" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: "12px" }}>Display Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={editingField.label}
                  onChange={(e) => updateEditingField((f) => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. Signer Name"
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: "12px" }}>System Variable ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={editingField.id}
                  onChange={(e) => {
                    const cleanId = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
                    updateEditingField((f) => ({ ...f, id: cleanId }));
                  }}
                  placeholder="e.g. signer_name"
                />
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  Must contain only lowercase letters, numbers, and underscores.
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: "12px" }}>Input Type</label>
                  <select
                    className="form-input"
                    value={editingField.type}
                    onChange={(e) => updateEditingField((f) => ({ ...f, type: e.target.value as any }))}
                    style={{ height: "42px", padding: "4px 8px" }}
                  >
                    <option value="text">Text Input</option>
                    <option value="date">Date Picker</option>
                    <option value="number">Number</option>
                    <option value="checkbox">Checkbox</option>
                    <option value="signature">Signature</option>
                    <option value="signer_name">Signer Name</option>
                    <option value="signer_email">Signer Email</option>
                    <option value="custom_email">Custom Email (e.g. Parent)</option>
                    <option value="dob">Date of Birth</option>
                    <option value="age">Age (Calculated)</option>
                    <option value="todays_date">Today's Date</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: "12px" }}>Validation</label>
                  <select
                    className="form-input"
                    value={String(editingField.required)}
                    onChange={(e) => updateEditingField((f) => ({ ...f, required: e.target.value === "true" }))}
                    style={{ height: "42px", padding: "4px 8px" }}
                  >
                    <option value="true">Required</option>
                    <option value="false">Optional</option>
                  </select>
                </div>
              </div>

              {/* Variable Linking (Custom Fields) */}
              {editingField.type !== "signer_name" && editingField.type !== "signer_email" && (
                <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "16px", marginTop: "4px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: "bold", cursor: "pointer", userSelect: "none" }}>
                    <input
                      type="checkbox"
                      checked={!!editingField.linkedFieldId}
                      onChange={(e) => {
                        updateEditingField((f) => {
                          if (e.target.checked) {
                            const other = fields.find((x) => x.id !== selectedFieldId);
                            return {
                              ...f,
                              linkedFieldId: other ? other.id : "",
                            };
                          } else {
                            const { linkedFieldId, ...rest } = f;
                            return rest as FormField;
                          }
                        });
                      }}
                      style={{ accentColor: "var(--primary-color)", width: "16px", height: "16px" }}
                    />
                    Link to another field (sync properties)
                  </label>

                  {editingField.linkedFieldId !== undefined && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: "var(--bg-card-hover)", padding: "12px", borderRadius: "6px", border: "1px solid var(--border-color)", marginTop: "10px" }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: "11px" }}>Select Field to Link With</label>
                        <select
                          className="form-input"
                          value={editingField.linkedFieldId}
                          onChange={(e) =>
                            updateEditingField((f) => ({
                              ...f,
                              linkedFieldId: e.target.value,
                            }))
                          }
                        >
                          <option value="">-- Choose Field --</option>
                          {fields
                            .filter((x) => x.id !== selectedFieldId)
                            .map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.label} ({x.id})
                              </option>
                            ))}
                        </select>
                        <span style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>
                          Once linked, changing Display Name, Validation, or Conditional rules on one field will update both simultaneously.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Conditional Logic Section */}
              <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "16px", marginTop: "4px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: "bold", cursor: "pointer", userSelect: "none" }}>
                  <input
                    type="checkbox"
                    checked={!!editingField.conditional}
                    onChange={(e) => {
                      updateEditingField((f) => {
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
                    style={{ accentColor: "var(--primary-color)", width: "16px", height: "16px" }}
                  />
                  Enable Conditional display
                </label>

                {editingField.conditional && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: "var(--bg-card-hover)", padding: "12px", borderRadius: "6px", border: "1px solid var(--border-color)", marginTop: "10px" }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: "11px" }}>Show if other Field ID</label>
                      <select
                        className="form-input"
                        value={editingField.conditional.field}
                        onChange={(e) =>
                          updateEditingField((f) => ({
                            ...f,
                            conditional: { ...f.conditional!, field: e.target.value },
                          }))
                        }
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

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: "11px" }}>Operator</label>
                        <select
                          className="form-input"
                          value={editingField.conditional.operator}
                          onChange={(e) =>
                            updateEditingField((f) => ({
                              ...f,
                              conditional: { ...f.conditional!, operator: e.target.value as any },
                            }))
                          }
                        >
                          <option value="equals">Equals</option>
                          <option value="greater_than">Greater Than (&gt;)</option>
                          <option value="less_than">Less Than (&lt;)</option>
                          <option value="checked">Is Checked</option>
                          <option value="age_less_than">Age Less Than (&lt;)</option>
                        </select>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: "11px" }}>Value</label>
                        <input
                          type="text"
                          className="form-input"
                          disabled={editingField.conditional.operator === "checked"}
                          value={editingField.conditional.value || ""}
                          onChange={(e) =>
                            updateEditingField((f) => ({
                              ...f,
                              conditional: { ...f.conditional!, value: e.target.value },
                            }))
                          }
                          placeholder="e.g. 18"
                        />
                      </div>

                      <div className="form-group" style={{ margin: 0, gridColumn: "span 2" }}>
                        <label className="form-label" style={{ fontSize: "11px" }}>Fallback Value (Show if conditions not met)</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editingField.conditional.fallbackValue || ""}
                          onChange={(e) =>
                            updateEditingField((f) => ({
                              ...f,
                              conditional: { ...f.conditional!, fallbackValue: e.target.value },
                            }))
                          }
                          placeholder="e.g. N/A or None (Leave empty to hide completely)"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", borderTop: "1px solid var(--border-color)", paddingTop: "16px", marginTop: "8px" }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setEditingField(null)} 
                style={{ width: "auto", minWidth: "100px" }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveProperties}
                style={{ width: "auto", minWidth: "120px" }}
              >
                OK / Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generated In-App Alert Dialog Overlay */}
      {alertState && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div className="card-glass" style={{ width: "400px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "bold" }}>{alertState.title || "Notification"}</h3>
            <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)", lineHeight: "1.5" }}>{alertState.message}</p>
            <button className="btn btn-primary" onClick={() => setAlertState(null)} style={{ alignSelf: "flex-end", width: "auto", minWidth: "80px" }}>
              OK
            </button>
          </div>
        </div>
      )}

      {/* Generated In-App Confirmation Dialog Overlay */}
      {confirmState && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div className="card-glass" style={{ width: "400px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "bold" }}>{confirmState.title}</h3>
            <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)", lineHeight: "1.5" }}>{confirmState.message}</p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setConfirmState(null)} style={{ width: "auto" }}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  confirmState.onConfirm();
                  setConfirmState(null);
                }}
                style={{ width: "auto" }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
