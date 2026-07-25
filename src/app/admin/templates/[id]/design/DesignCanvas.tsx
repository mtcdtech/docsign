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
  instanceId?: string;
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
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
  const selectedFieldId = selectedFieldIds[0] || null;
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
  const dragStartCoords = useRef<{
    mouseX: number;
    mouseY: number;
    fields: { [id: string]: { x: number; y: number; width: number; height: number } };
  }>({
    mouseX: 0,
    mouseY: 0,
    fields: {},
  });

  const renderedPagesRef = useRef<Set<number>>(new Set());

  // Sidebar collapsible sections states
  const [isToolboxExpanded, setIsToolboxExpanded] = useState(true);
  const [isPropertiesExpanded, setIsPropertiesExpanded] = useState(false);
  const [isPlacedVariablesExpanded, setIsPlacedVariablesExpanded] = useState(true);

  // Auto-expand/collapse sidebar sections based on selection state
  useEffect(() => {
    if (selectedFieldId) {
      setIsPropertiesExpanded(true);
      setIsToolboxExpanded(false);
      setIsPlacedVariablesExpanded(false);
    } else {
      setIsPropertiesExpanded(false);
      setIsToolboxExpanded(true);
      setIsPlacedVariablesExpanded(true);
    }
  }, [selectedFieldId, selectedFieldIds]);

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
      if (selectedFieldIds.length > 0 && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        handleDeleteFields(selectedFieldIds);
        return;
      }

      // 2. Copy element (Ctrl/Cmd + C)
      if (selectedFieldId && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        const field = fields.find((f) => (f.instanceId || f.id) === selectedFieldId);
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
          instanceId: Math.random().toString(36).substring(2, 9),
          id: newId,
          label: newLabel,
          pdfMapping: {
            ...copiedField.pdfMapping,
            x: Math.min(95, copiedField.pdfMapping.x + 3),
            y: Math.min(95, copiedField.pdfMapping.y + 3),
          },
        };

        setFields((prev) => [...prev, newField]);
        setSelectedFieldIds([newField.instanceId!]);
        return;
      }

      // 4. Move elements with Arrow keys
      if (selectedFieldIds.length > 0 && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 3.0 : 0.5;

        setFields((prev) =>
          prev.map((f) => {
            const key = f.instanceId || f.id;
            if (!selectedFieldIds.includes(key)) return f;
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
  }, [selectedFieldId, selectedFieldIds, fields, copiedField]);

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

          const viewport = page.getViewport({ scale: 1.2 });
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
      const fieldIndex = fields.findIndex((f) => (f.instanceId || f.id) === draggedFieldId);
      if (fieldIndex === -1) return;

      const field = fields[fieldIndex];
      const pageIndex = field.pdfMapping.page;
      const overlay = document.getElementById(`pdf-overlay-${pageIndex}`);
      if (!overlay) return;

      const rect = overlay.getBoundingClientRect();

      if (activeAction === "moving") {
        const deltaX = e.clientX - dragStartCoords.current.mouseX;
        const deltaY = e.clientY - dragStartCoords.current.mouseY;

        setFields((prev) =>
          prev.map((f) => {
            const key = f.instanceId || f.id;
            const start = dragStartCoords.current.fields[key];
            if (!start) return f;

            const fieldOverlay = document.getElementById(`pdf-overlay-${f.pdfMapping.page}`);
            const fieldRect = fieldOverlay ? fieldOverlay.getBoundingClientRect() : rect;

            const deltaXPercent = (deltaX / fieldRect.width) * 100;
            const deltaYPercent = (deltaY / fieldRect.height) * 100;

            const newX = Math.max(
              0,
              Math.min(
                100 - (f.pdfMapping.width / fieldRect.width) * 100,
                start.x + deltaXPercent
              )
            );
            const newY = Math.max(
              0,
              Math.min(
                100 - (f.pdfMapping.height / fieldRect.height) * 100,
                start.y + deltaYPercent
              )
            );

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
      } else if (activeAction === "resizing") {
        const deltaX = e.clientX - dragStartCoords.current.mouseX;
        const deltaY = e.clientY - dragStartCoords.current.mouseY;

        const start = dragStartCoords.current.fields[draggedFieldId];
        if (!start) return;

        const newW = Math.max(18, start.width + deltaX);
        const newH = Math.max(18, start.height + deltaY);

        setFields((prev) =>
          prev.map((f) =>
            (f.instanceId || f.id) === draggedFieldId
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

  // Selection handling helper
  const handleSelectField = (fieldId: string | null, isMultiSelect = false) => {
    if (fieldId === null) {
      setSelectedFieldIds([]);
      return;
    }
    setSelectedFieldIds((prev) => {
      if (isMultiSelect) {
        if (prev.includes(fieldId)) {
          return prev.filter((id) => id !== fieldId);
        } else {
          return [...prev, fieldId];
        }
      } else {
        return [fieldId];
      }
    });
  };

  // Start Move Action
  const handleStartMove = (
    e: React.MouseEvent<HTMLDivElement>,
    field: FormField
  ) => {
    e.stopPropagation();
    const fKey = field.instanceId || field.id;
    const isMulti = e.shiftKey || e.metaKey || e.ctrlKey;
    
    let currentSelected = selectedFieldIds;
    if (!currentSelected.includes(fKey)) {
      currentSelected = isMulti ? [...currentSelected, fKey] : [fKey];
      setSelectedFieldIds(currentSelected);
    }

    setActiveAction("moving");
    setDraggedFieldId(fKey);

    const startFields: { [id: string]: { x: number; y: number; width: number; height: number } } = {};
    fields.forEach((f) => {
      const key = f.instanceId || f.id;
      if (currentSelected.includes(key)) {
        startFields[key] = {
          x: f.pdfMapping.x,
          y: f.pdfMapping.y,
          width: f.pdfMapping.width,
          height: f.pdfMapping.height,
        };
      }
    });

    dragStartCoords.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      fields: startFields,
    };
  };

  // Start Resize Action
  const handleStartResize = (
    e: React.MouseEvent<HTMLDivElement>,
    field: FormField
  ) => {
    e.stopPropagation();
    const fKey = field.instanceId || field.id;
    // Resizing only affects the single dragged field, so we select just it
    setSelectedFieldIds([fKey]);
    setActiveAction("resizing");
    setDraggedFieldId(fKey);
    
    dragStartCoords.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      fields: {
        [fKey]: {
          x: field.pdfMapping.x,
          y: field.pdfMapping.y,
          width: field.pdfMapping.width,
          height: field.pdfMapping.height,
        }
      }
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

    const isSignerType = type === "signer_name" || type === "signer_email";
    const existingField = isSignerType ? fields.find((f) => f.type === type) : null;

    const finalId = existingField ? existingField.id : id;
    const finalLabel = existingField ? existingField.label : label;
    const finalRequired = isSignerType ? true : (existingField ? existingField.required : true);
    const finalConditional = existingField ? existingField.conditional : undefined;

    const newField: FormField = {
      instanceId: Math.random().toString(36).substring(2, 9),
      id: finalId,
      label: finalLabel,
      type: type as any,
      required: finalRequired,
      conditional: finalConditional,
      pdfMapping: {
        page: pageIdx,
        x,
        y,
        width: defaultWidth,
        height: defaultHeight,
      },
    };

    setFields((prev) => [...prev, newField]);
    setSelectedFieldIds([newField.instanceId!]);
  };

  // Selected Field Properties Updates
  const selectedField = fields.find((f) => (f.instanceId || f.id) === selectedFieldId) || null;

  const isIdDuplicate = (fieldId: string, fKey: string) => {
    const cleanId = fieldId.trim().toLowerCase();
    if (!cleanId) return false;
    return fields.some((f) => {
      const key = f.instanceId || f.id;
      if (key === fKey) return false;
      const current = fields.find((x) => (x.instanceId || x.id) === fKey);
      if (current && current.linkedFieldId === key) return false;
      if (f.linkedFieldId === fKey) return false;
      const isSignerType = current && (current.type === "signer_name" || current.type === "signer_email");
      if (isSignerType && f.type === current.type) return false;
      return f.id === cleanId;
    });
  };

  const handleUpdateFieldProperty = (fKey: string, updates: Partial<FormField>) => {
    setFields((prev) => {
      const current = prev.find((f) => (f.instanceId || f.id) === fKey);
      if (!current) return prev;

      const updatedField = { ...current, ...updates };

      if (updatedField.type === "signer_name" || updatedField.type === "signer_email") {
        updatedField.required = true;
      }

      if (updates.id !== undefined) {
        updatedField.id = updates.id.toLowerCase().replace(/[^a-z0-9_]/g, "");
      }

      if (updates.label !== undefined) {
        let generatedId = updates.label
          .toLowerCase()
          .replace(/[^a-z0-9_]+/g, "_")
          .replace(/^_+|_+$/g, "");
        
        if (!generatedId) {
          generatedId = current.type;
        }

        let uniqueId = generatedId;
        let counter = 2;
        while (
          prev.some((f) => {
            const key = f.instanceId || f.id;
            if (key === fKey) return false;
            const isSignerType = current.type === "signer_name" || current.type === "signer_email";
            if (isSignerType && f.type === current.type) return false;
            if (current.linkedFieldId === key) return false;
            if (f.linkedFieldId === fKey) return false;
            return f.id === uniqueId;
          })
        ) {
          uniqueId = `${generatedId}_${counter}`;
          counter++;
        }
        updatedField.id = uniqueId;
      }

      const isSignerType = updatedField.type === "signer_name" || updatedField.type === "signer_email";
      const hasCustomLink = !isSignerType && updatedField.linkedFieldId;

      return prev.map((f) => {
        const key = f.instanceId || f.id;

        if (key === fKey) {
          return updatedField;
        }

        if (isSignerType && f.type === updatedField.type) {
          return {
            ...f,
            id: updatedField.id,
            label: updatedField.label,
            required: updatedField.required,
            conditional: updatedField.conditional,
          };
        }

        if (hasCustomLink && key === updatedField.linkedFieldId) {
          return {
            ...f,
            id: updatedField.id,
            label: updatedField.label,
            required: updatedField.required,
            conditional: updatedField.conditional,
            linkedFieldId: fKey,
          };
        }

        if (!isSignerType && f.linkedFieldId === fKey) {
          if (updatedField.linkedFieldId !== key) {
            return { ...f, linkedFieldId: undefined };
          } else {
            return {
              ...f,
              id: updatedField.id,
              label: updatedField.label,
              required: updatedField.required,
              conditional: updatedField.conditional,
              linkedFieldId: fKey,
            };
          }
        }

        return f;
      });
    });
  };

  const handleDeleteFields = (keys: string[]) => {
    if (keys.length === 0) return;
    const labels = keys.map(k => fields.find(f => (f.instanceId || f.id) === k)?.label || k).join(", ");
    setConfirmState({
      title: "Delete Variables",
      message: `Are you sure you want to remove the selected variable(s) (${labels}) from this template mapping?`,
      onConfirm: () => {
        setFields((prev) => prev.filter((f) => !keys.includes(f.instanceId || f.id)));
        setSelectedFieldIds([]);
      },
    });
  };

  const handleDeleteField = (instanceKey: string) => {
    handleDeleteFields([instanceKey]);
  };

  // Sizing and alignment helpers
  const handleAlignLeft = () => {
    if (selectedFieldIds.length < 2) return;
    const refField = fields.find((f) => (f.instanceId || f.id) === selectedFieldIds[0]);
    if (!refField) return;
    setFields((prev) =>
      prev.map((f) => {
        const key = f.instanceId || f.id;
        if (selectedFieldIds.includes(key) && key !== selectedFieldIds[0]) {
          return {
            ...f,
            pdfMapping: {
              ...f.pdfMapping,
              x: refField.pdfMapping.x,
            },
          };
        }
        return f;
      })
    );
  };

  const handleAlignRight = () => {
    if (selectedFieldIds.length < 2) return;
    const refField = fields.find((f) => (f.instanceId || f.id) === selectedFieldIds[0]);
    if (!refField) return;
    
    setFields((prev) =>
      prev.map((f) => {
        const key = f.instanceId || f.id;
        if (selectedFieldIds.includes(key) && key !== selectedFieldIds[0]) {
          const overlay = document.getElementById(`pdf-overlay-${f.pdfMapping.page}`);
          const pageWidth = overlay ? overlay.getBoundingClientRect().width : 800;
          const newX = refField.pdfMapping.x + ((refField.pdfMapping.width - f.pdfMapping.width) / pageWidth) * 100;
          return {
            ...f,
            pdfMapping: {
              ...f.pdfMapping,
              x: Math.max(0, Math.min(100, newX)),
            },
          };
        }
        return f;
      })
    );
  };

  const handleAlignTop = () => {
    if (selectedFieldIds.length < 2) return;
    const refField = fields.find((f) => (f.instanceId || f.id) === selectedFieldIds[0]);
    if (!refField) return;
    setFields((prev) =>
      prev.map((f) => {
        const key = f.instanceId || f.id;
        if (selectedFieldIds.includes(key) && key !== selectedFieldIds[0]) {
          return {
            ...f,
            pdfMapping: {
              ...f.pdfMapping,
              y: refField.pdfMapping.y,
            },
          };
        }
        return f;
      })
    );
  };

  const handleAlignBottom = () => {
    if (selectedFieldIds.length < 2) return;
    const refField = fields.find((f) => (f.instanceId || f.id) === selectedFieldIds[0]);
    if (!refField) return;
    
    setFields((prev) =>
      prev.map((f) => {
        const key = f.instanceId || f.id;
        if (selectedFieldIds.includes(key) && key !== selectedFieldIds[0]) {
          const overlay = document.getElementById(`pdf-overlay-${f.pdfMapping.page}`);
          const pageHeight = overlay ? overlay.getBoundingClientRect().height : 1000;
          const newY = refField.pdfMapping.y + ((refField.pdfMapping.height - f.pdfMapping.height) / pageHeight) * 100;
          return {
            ...f,
            pdfMapping: {
              ...f.pdfMapping,
              y: Math.max(0, Math.min(100, newY)),
            },
          };
        }
        return f;
      })
    );
  };

  const handleMatchWidth = () => {
    if (selectedFieldIds.length < 2) return;
    const refField = fields.find((f) => (f.instanceId || f.id) === selectedFieldIds[0]);
    if (!refField) return;
    setFields((prev) =>
      prev.map((f) => {
        const key = f.instanceId || f.id;
        if (selectedFieldIds.includes(key) && key !== selectedFieldIds[0]) {
          return {
            ...f,
            pdfMapping: {
              ...f.pdfMapping,
              width: refField.pdfMapping.width,
            },
          };
        }
        return f;
      })
    );
  };

  const handleMatchHeight = () => {
    if (selectedFieldIds.length < 2) return;
    const refField = fields.find((f) => (f.instanceId || f.id) === selectedFieldIds[0]);
    if (!refField) return;
    setFields((prev) =>
      prev.map((f) => {
        const key = f.instanceId || f.id;
        if (selectedFieldIds.includes(key) && key !== selectedFieldIds[0]) {
          return {
            ...f,
            pdfMapping: {
              ...f.pdfMapping,
              height: refField.pdfMapping.height,
            },
          };
        }
        return f;
      })
    );
  };

  const handleDistributeHorizontally = () => {
    const selectedFields = fields.filter((f) => selectedFieldIds.includes(f.instanceId || f.id));
    if (selectedFields.length < 3) {
      setAlertState({
        title: "Distribute Fields",
        message: "Please select at least 3 fields to distribute."
      });
      return;
    }
    const sorted = [...selectedFields].sort((a, b) => a.pdfMapping.x - b.pdfMapping.x);
    const minX = sorted[0].pdfMapping.x;
    const maxX = sorted[sorted.length - 1].pdfMapping.x;
    const step = (maxX - minX) / (sorted.length - 1);
    
    setFields((prev) =>
      prev.map((f) => {
        const key = f.instanceId || f.id;
        const idx = sorted.findIndex((s) => (s.instanceId || s.id) === key);
        if (idx !== -1) {
          return {
            ...f,
            pdfMapping: {
              ...f.pdfMapping,
              x: minX + idx * step,
            },
          };
        }
        return f;
      })
    );
  };

  const handleDistributeVertically = () => {
    const selectedFields = fields.filter((f) => selectedFieldIds.includes(f.instanceId || f.id));
    if (selectedFields.length < 3) {
      setAlertState({
        title: "Distribute Fields",
        message: "Please select at least 3 fields to distribute."
      });
      return;
    }
    const sorted = [...selectedFields].sort((a, b) => a.pdfMapping.y - b.pdfMapping.y);
    const minY = sorted[0].pdfMapping.y;
    const maxY = sorted[sorted.length - 1].pdfMapping.y;
    const step = (maxY - minY) / (sorted.length - 1);
    
    setFields((prev) =>
      prev.map((f) => {
        const key = f.instanceId || f.id;
        const idx = sorted.findIndex((s) => (s.instanceId || s.id) === key);
        if (idx !== -1) {
          return {
            ...f,
            pdfMapping: {
              ...f.pdfMapping,
              y: minY + idx * step,
            },
          };
        }
        return f;
      })
    );
  };

  const handleEqualizeHorizontalSpacing = () => {
    const selectedFields = fields.filter((f) => selectedFieldIds.includes(f.instanceId || f.id));
    if (selectedFields.length < 3) {
      setAlertState({
        title: "Equalize Spacing",
        message: "Please select at least 3 fields to equalize spacing."
      });
      return;
    }
    const sorted = [...selectedFields].sort((a, b) => a.pdfMapping.x - b.pdfMapping.x);
    const pageIdx = sorted[0].pdfMapping.page;
    const overlay = document.getElementById(`pdf-overlay-${pageIdx}`);
    const pageWidth = overlay ? overlay.getBoundingClientRect().width : 800;
    
    let totalWidthPercent = 0;
    sorted.forEach((sf) => {
      const wPercent = (sf.pdfMapping.width / pageWidth) * 100;
      totalWidthPercent += wPercent;
    });
    
    const minX = sorted[0].pdfMapping.x;
    const lastField = sorted[sorted.length - 1];
    const lastFieldWidthPercent = (lastField.pdfMapping.width / pageWidth) * 100;
    const maxXPlusWidth = lastField.pdfMapping.x + lastFieldWidthPercent;
    
    const totalSpan = maxXPlusWidth - minX;
    const totalWhitespace = totalSpan - totalWidthPercent;
    const gap = totalWhitespace / (sorted.length - 1);
    
    let currentX = minX;
    const newPositions: { [key: string]: number } = {};
    sorted.forEach((sf) => {
      const key = sf.instanceId || sf.id;
      newPositions[key] = currentX;
      const wPercent = (sf.pdfMapping.width / pageWidth) * 100;
      currentX += wPercent + gap;
    });
    
    setFields((prev) =>
      prev.map((f) => {
        const key = f.instanceId || f.id;
        if (key in newPositions) {
          return {
            ...f,
            pdfMapping: {
              ...f.pdfMapping,
              x: Math.max(0, Math.min(100 - (f.pdfMapping.width / pageWidth) * 100, newPositions[key])),
            },
          };
        }
        return f;
      })
    );
  };

  const handleEqualizeVerticalSpacing = () => {
    const selectedFields = fields.filter((f) => selectedFieldIds.includes(f.instanceId || f.id));
    if (selectedFields.length < 3) {
      setAlertState({
        title: "Equalize Spacing",
        message: "Please select at least 3 fields to equalize spacing."
      });
      return;
    }
    const sorted = [...selectedFields].sort((a, b) => a.pdfMapping.y - b.pdfMapping.y);
    const pageIdx = sorted[0].pdfMapping.page;
    const overlay = document.getElementById(`pdf-overlay-${pageIdx}`);
    const pageHeight = overlay ? overlay.getBoundingClientRect().height : 1000;
    
    let totalHeightPercent = 0;
    sorted.forEach((sf) => {
      const hPercent = (sf.pdfMapping.height / pageHeight) * 100;
      totalHeightPercent += hPercent;
    });
    
    const minY = sorted[0].pdfMapping.y;
    const lastField = sorted[sorted.length - 1];
    const lastFieldHeightPercent = (lastField.pdfMapping.height / pageHeight) * 100;
    const maxYPlusHeight = lastField.pdfMapping.y + lastFieldHeightPercent;
    
    const totalSpan = maxYPlusHeight - minY;
    const totalWhitespace = totalSpan - totalHeightPercent;
    const gap = totalWhitespace / (sorted.length - 1);
    
    let currentY = minY;
    const newPositions: { [key: string]: number } = {};
    sorted.forEach((sf) => {
      const key = sf.instanceId || sf.id;
      newPositions[key] = currentY;
      const hPercent = (sf.pdfMapping.height / pageHeight) * 100;
      currentY += hPercent + gap;
    });
    
    setFields((prev) =>
      prev.map((f) => {
        const key = f.instanceId || f.id;
        if (key in newPositions) {
          return {
            ...f,
            pdfMapping: {
              ...f.pdfMapping,
              y: Math.max(0, Math.min(100 - (f.pdfMapping.height / pageHeight) * 100, newPositions[key])),
            },
          };
        }
        return f;
      })
    );
  };

  // Save layout to database
  const handleSaveSchema = async () => {
    const hasSignerName = fields.some((f) => f.type === "signer_name");
    const hasSignerEmail = fields.some((f) => f.type === "signer_email");

    if (!hasSignerName || !hasSignerEmail) {
      const missing = [];
      if (!hasSignerName) missing.push("Signer Name");
      if (!hasSignerEmail) missing.push("Signer Email");
      
      setAlertState({
        title: "Required Fields Missing",
        message: `Every form must include both the Signer Name and Signer Email fields. Please drag and place the missing field(s): ${missing.join(", ")}.`
      });
      return;
    }

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
        <div style={{ width: "360px", minWidth: "360px", maxWidth: "360px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "16px", position: "sticky", top: "100px", maxHeight: "calc(100vh - 140px)", overflowX: "hidden" }}>
          
          {/* Scrollable sidebar cards container */}
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px", paddingRight: "4px" }}>
            
            {/* Section 1: Drag-and-Drop Elements Library */}
            <div className="card-glass" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px", flexShrink: 0 }}>
              <h3 
                onClick={() => setIsToolboxExpanded(!isToolboxExpanded)} 
                style={{ margin: 0, fontSize: "15px", fontWeight: "bold", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}
              >
                <span>🧰 Toolbox Library</span>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{isToolboxExpanded ? "▼" : "▶"}</span>
              </h3>
              
              {isToolboxExpanded && (
                <>
                  <p style={{ margin: 0, fontSize: "11px", color: "var(--text-muted)" }}>
                    Drag elements onto the document pages to overlay variables.
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.05em", marginTop: "4px" }}>
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

                    <div style={{ fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.05em", borderTop: "1px solid var(--border-color)", paddingTop: "10px", marginTop: "4px" }}>
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
                  </div>
                </>
              )}
            </div>

            {/* Section 2: Selected Field Properties Configuration Summary */}
            <div className="card-glass" style={{ padding: "16px", minHeight: isPropertiesExpanded ? "120px" : "auto", display: "flex", flexDirection: "column", gap: "12px", flexShrink: 0 }}>
              <h3 
                onClick={() => setIsPropertiesExpanded(!isPropertiesExpanded)} 
                style={{ margin: 0, fontSize: "15px", fontWeight: "bold", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}
              >
                <span>⚙️ Properties Editor</span>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{isPropertiesExpanded ? "▼" : "▶"}</span>
              </h3>
              
              {isPropertiesExpanded && (
                <>
                  {selectedFieldIds.length > 1 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "bold", textTransform: "uppercase" }}>
                        Selected Fields ({selectedFieldIds.length})
                      </div>
                      
                      <div style={{ background: "rgba(255,255,255,0.03)", padding: "10px", borderRadius: "6px", border: "1px solid var(--border-color)", fontSize: "12px" }}>
                        <span style={{ color: "var(--text-muted)" }}>Anchor: </span>
                        <strong>
                          {fields.find((f) => (f.instanceId || f.id) === selectedFieldIds[0])?.label || "None"}
                        </strong>
                      </div>

                      <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "bold", textTransform: "uppercase", marginTop: "4px" }}>
                        Alignment Actions
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <button className="btn btn-secondary" onClick={handleAlignLeft} style={{ fontSize: "12px", padding: "8px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                          ⬅️ Align Left
                        </button>
                        <button className="btn btn-secondary" onClick={handleAlignRight} style={{ fontSize: "12px", padding: "8px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                          ➡️ Align Right
                        </button>
                        <button className="btn btn-secondary" onClick={handleAlignTop} style={{ fontSize: "12px", padding: "8px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                          ⬆️ Align Top
                        </button>
                        <button className="btn btn-secondary" onClick={handleAlignBottom} style={{ fontSize: "12px", padding: "8px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                          ⬇️ Align Bottom
                        </button>
                      </div>

                      <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "bold", textTransform: "uppercase", marginTop: "4px" }}>
                        Match Sizes
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <button className="btn btn-secondary" onClick={handleMatchWidth} style={{ fontSize: "12px", padding: "8px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                          ↔️ Match Width
                        </button>
                        <button className="btn btn-secondary" onClick={handleMatchHeight} style={{ fontSize: "12px", padding: "8px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                          ↕️ Match Height
                        </button>
                      </div>

                      <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "bold", textTransform: "uppercase", marginTop: "4px" }}>
                        Distribute & Spacing
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <button className="btn btn-secondary" onClick={handleDistributeHorizontally} style={{ fontSize: "11px", padding: "8px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }} title="Distribute horizontal start coordinates evenly">
                          ↔️ Distribute Horiz
                        </button>
                        <button className="btn btn-secondary" onClick={handleDistributeVertically} style={{ fontSize: "11px", padding: "8px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }} title="Distribute vertical start coordinates evenly">
                          ↕️ Distribute Vert
                        </button>
                        <button className="btn btn-secondary" onClick={handleEqualizeHorizontalSpacing} style={{ fontSize: "11px", padding: "8px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }} title="Make horizontal whitespace gaps between elements equal">
                          ↔️ Spacing Gap H
                        </button>
                        <button className="btn btn-secondary" onClick={handleEqualizeVerticalSpacing} style={{ fontSize: "11px", padding: "8px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }} title="Make vertical whitespace gaps between elements equal">
                          ↕️ Spacing Gap V
                        </button>
                      </div>

                      <button className="btn btn-danger" onClick={() => setSelectedFieldIds([])} style={{ width: "100%", padding: "10px", fontSize: "12px", marginTop: "8px" }}>
                        Deselect All
                      </button>
                    </div>
                  ) : selectedField ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: "11px" }}>Display Name</label>
                        <input
                          type="text"
                          className="form-input"
                          value={selectedField.label}
                          onChange={(e) => handleUpdateFieldProperty(selectedFieldId!, { label: e.target.value })}
                          placeholder="e.g. Signer Name"
                          style={{ padding: "8px", fontSize: "13px" }}
                        />
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: "11px" }}>System Variable ID</label>
                        <input
                          type="text"
                          className="form-input"
                          value={selectedField.id}
                          onChange={(e) => handleUpdateFieldProperty(selectedFieldId!, { id: e.target.value })}
                          placeholder="e.g. signer_name"
                          style={{ padding: "8px", fontSize: "13px" }}
                        />
                        {isIdDuplicate(selectedField.id, selectedFieldId!) && (
                          <div style={{ color: "#ef4444", fontSize: "11px", marginTop: "4px", fontWeight: "bold" }}>
                            ⚠️ Duplicate ID! Already in use.
                          </div>
                        )}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: "11px" }}>Input Type</label>
                          <select
                            className="form-input"
                            value={selectedField.type}
                            onChange={(e) => handleUpdateFieldProperty(selectedFieldId!, { type: e.target.value as any })}
                            style={{ height: "36px", padding: "4px 8px", fontSize: "12px" }}
                          >
                            <option value="text">Text Input</option>
                            <option value="date">Date Picker</option>
                            <option value="number">Number</option>
                            <option value="checkbox">Checkbox</option>
                            <option value="signature">Signature</option>
                            <option value="signer_name">Signer Name</option>
                            <option value="signer_email">Signer Email</option>
                            <option value="custom_email">Custom Email</option>
                            <option value="dob">Date of Birth</option>
                            <option value="age">Age (Calculated)</option>
                            <option value="todays_date">Today's Date</option>
                          </select>
                        </div>

                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: "11px" }}>Validation</label>
                          <select
                            className="form-input"
                            value={String(selectedField.type === "signer_name" || selectedField.type === "signer_email" ? true : selectedField.required)}
                            onChange={(e) => handleUpdateFieldProperty(selectedFieldId!, { required: e.target.value === "true" })}
                            disabled={selectedField.type === "signer_name" || selectedField.type === "signer_email"}
                            style={{ height: "36px", padding: "4px 8px", fontSize: "12px" }}
                          >
                            <option value="true">Required</option>
                            <option value="false">Optional</option>
                          </select>
                        </div>
                      </div>

                      {/* Variable Linking (Custom Fields) */}
                      {selectedField.type !== "signer_name" && selectedField.type !== "signer_email" && (
                        <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "8px" }}>
                          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", userSelect: "none" }}>
                            <input
                              type="checkbox"
                              checked={!!selectedField.linkedFieldId}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  const other = fields.find((x) => (x.instanceId || x.id) !== selectedFieldId);
                                  if (other) {
                                    handleUpdateFieldProperty(selectedFieldId!, {
                                      id: other.id,
                                      label: other.label,
                                      required: other.required,
                                      conditional: other.conditional,
                                      linkedFieldId: other.instanceId || other.id,
                                    });
                                  } else {
                                    handleUpdateFieldProperty(selectedFieldId!, { linkedFieldId: "" });
                                  }
                                } else {
                                  // Clear linked fields mapping
                                  setFields((prev) =>
                                    prev.map((f) => {
                                      const key = f.instanceId || f.id;
                                      if (key === selectedFieldId) {
                                        const { linkedFieldId, ...rest } = f;
                                        return rest as FormField;
                                      }
                                      return f;
                                    })
                                  );
                                }
                              }}
                              style={{ accentColor: "var(--primary-color)", width: "14px", height: "14px" }}
                            />
                            Link to another field
                          </label>

                          {selectedField.linkedFieldId !== undefined && (
                            <div style={{ background: "rgba(255,255,255,0.02)", padding: "8px", borderRadius: "6px", border: "1px solid var(--border-color)", marginTop: "6px" }}>
                              <select
                                className="form-input"
                                value={selectedField.linkedFieldId}
                                onChange={(e) => {
                                  const targetId = e.target.value;
                                  const other = fields.find((x) => (x.instanceId || x.id) === targetId);
                                  if (other) {
                                    handleUpdateFieldProperty(selectedFieldId!, {
                                      id: other.id,
                                      label: other.label,
                                      required: other.required,
                                      conditional: other.conditional,
                                      linkedFieldId: targetId,
                                    });
                                  } else {
                                    handleUpdateFieldProperty(selectedFieldId!, { linkedFieldId: targetId });
                                  }
                                }}
                                style={{ height: "30px", padding: "2px 6px", fontSize: "11px", width: "100%" }}
                              >
                                <option value="">-- Choose Field --</option>
                                {fields
                                  .filter((x) => (x.instanceId || x.id) !== selectedFieldId)
                                  .map((x) => {
                                    const xKey = x.instanceId || x.id;
                                    return (
                                      <option key={xKey} value={xKey}>
                                        {x.label} ({x.id})
                                      </option>
                                    );
                                  })}
                              </select>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Conditional Logic Section */}
                      <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "8px" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", userSelect: "none" }}>
                          <input
                            type="checkbox"
                            checked={!!selectedField.conditional}
                            onChange={(e) => {
                              if (e.target.checked) {
                                handleUpdateFieldProperty(selectedFieldId!, {
                                  conditional: { field: "", operator: "equals", value: "" }
                                });
                              } else {
                                setFields((prev) =>
                                  prev.map((f) => {
                                    if ((f.instanceId || f.id) === selectedFieldId) {
                                      const { conditional, ...rest } = f;
                                      return rest as FormField;
                                    }
                                    return f;
                                  })
                                );
                              }
                            }}
                            style={{ accentColor: "var(--primary-color)", width: "14px", height: "14px" }}
                          />
                          Enable Conditional display
                        </label>

                        {selectedField.conditional && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px", background: "rgba(255,255,255,0.02)", padding: "8px", borderRadius: "6px", border: "1px solid var(--border-color)", marginTop: "6px", fontSize: "11px" }}>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label className="form-label" style={{ fontSize: "10px" }}>Show if other Field ID</label>
                              <select
                                className="form-input"
                                value={selectedField.conditional.field}
                                onChange={(e) =>
                                  handleUpdateFieldProperty(selectedFieldId!, {
                                    conditional: { ...selectedField.conditional!, field: e.target.value },
                                  })
                                }
                                style={{ height: "30px", padding: "2px 6px", fontSize: "11px", width: "100%" }}
                              >
                                <option value="">-- Choose Field --</option>
                                {fields
                                  .filter((f) => f.id !== selectedField.id)
                                  .map((f) => (
                                    <option key={f.id} value={f.id}>
                                      {f.label} ({f.id})
                                    </option>
                                  ))}
                              </select>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontSize: "10px" }}>Operator</label>
                                <select
                                  className="form-input"
                                  value={selectedField.conditional.operator}
                                  onChange={(e) =>
                                    handleUpdateFieldProperty(selectedFieldId!, {
                                      conditional: { ...selectedField.conditional!, operator: e.target.value as any },
                                    })
                                  }
                                  style={{ height: "30px", padding: "2px 6px", fontSize: "11px", width: "100%" }}
                                >
                                  <option value="equals">Equals</option>
                                  <option value="greater_than">Greater Than (&gt;)</option>
                                  <option value="less_than">Less Than (&lt;)</option>
                                  <option value="checked">Is Checked</option>
                                  <option value="age_less_than">Age Less Than (&lt;)</option>
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
                                    handleUpdateFieldProperty(selectedFieldId!, {
                                      conditional: { ...selectedField.conditional!, value: e.target.value },
                                    })
                                  }
                                  placeholder="e.g. 18"
                                  style={{ padding: "4px 8px", fontSize: "11px", height: "30px", width: "100%" }}
                                />
                              </div>

                              <div className="form-group" style={{ margin: 0, gridColumn: "span 2" }}>
                                <label className="form-label" style={{ fontSize: "10px" }}>Fallback Value</label>
                                <input
                                  type="text"
                                  className="form-input"
                                  value={selectedField.conditional.fallbackValue || ""}
                                  onChange={(e) =>
                                    handleUpdateFieldProperty(selectedFieldId!, {
                                      conditional: { ...selectedField.conditional!, fallbackValue: e.target.value },
                                    })
                                  }
                                  placeholder="e.g. N/A (Leave empty to hide)"
                                  style={{ padding: "4px 8px", fontSize: "11px", height: "30px", width: "100%" }}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleDeleteField(selectedFieldId!)}
                        className="btn btn-danger"
                        style={{ width: "100%", padding: "10px", fontSize: "12px", marginTop: "4px" }}
                      >
                        Remove Variable
                      </button>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "12px", padding: "24px 0", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      Click placed field(s) on the document to edit details or align them. Hold Shift / Cmd to select multiple.
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Section 3: Placed elements list & Action triggers */}
            <div className="card-glass" style={{ padding: "16px", flex: 1, display: "flex", flexDirection: "column", gap: "16px", minHeight: isPlacedVariablesExpanded ? "200px" : "auto" }}>
              <h3 
                onClick={() => setIsPlacedVariablesExpanded(!isPlacedVariablesExpanded)} 
                style={{ margin: 0, fontSize: "15px", fontWeight: "bold", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}
              >
                <span>📋 Placed Variables ({fields.length})</span>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{isPlacedVariablesExpanded ? "▼" : "▶"}</span>
              </h3>
              
              {isPlacedVariablesExpanded && (() => {
                const sortedFields = [...fields].sort((a, b) => {
                  if (a.pdfMapping.page !== b.pdfMapping.page) {
                    return a.pdfMapping.page - b.pdfMapping.page;
                  }
                  if (a.pdfMapping.y !== b.pdfMapping.y) {
                    return a.pdfMapping.y - b.pdfMapping.y;
                  }
                  return a.pdfMapping.x - b.pdfMapping.x;
                });

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1, overflowY: "auto", maxHeight: "250px" }}>
                    {sortedFields.length === 0 ? (
                      <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "12px", padding: "10px" }}>
                        No variables placed on this document yet.
                      </div>
                    ) : (
                      sortedFields.map((f) => {
                        const fKey = f.instanceId || f.id;
                        const isFieldSelected = selectedFieldIds.includes(fKey);
                        return (
                          <div
                            key={fKey}
                            onClick={(e) => {
                              const isMulti = e.shiftKey || e.metaKey || e.ctrlKey;
                              handleSelectField(fKey, isMulti);
                            }}
                            style={{
                              background: isFieldSelected ? "var(--primary-glow)" : "rgba(255,255,255,0.01)",
                              border: isFieldSelected ? "1px solid var(--primary-color)" : "1px solid var(--border-color)",
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
                                  setSelectedFieldIds([fKey]);
                                  setIsPropertiesExpanded(true);
                                }}
                                title="Focus Properties"
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
                                  handleDeleteField(fKey);
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
                        );
                      })
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Pinned Save button area at bottom of sidebar */}
          <div style={{ flexShrink: 0, paddingTop: "12px", borderTop: "1px solid var(--border-color)", background: "transparent" }}>
            <button
              onClick={handleSaveSchema}
              disabled={saving}
              className="btn btn-primary"
              style={{ width: "100%", padding: "14px" }}
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
                onClick={() => setSelectedFieldIds([])}
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
                    const fKey = f.instanceId || f.id;
                    const isSelected = selectedFieldIds.includes(fKey);
                    const isAnchor = selectedFieldIds[0] === fKey;
                    
                    const borderStyle = isAnchor
                      ? "2px solid var(--primary-color)"
                      : (isSelected
                        ? "2px dashed var(--primary-color)"
                        : (f.type === "age" || f.type === "todays_date"
                          ? "1.5px dashed var(--primary-color)"
                          : "1px solid var(--text-muted)"));
                    const shadowStyle = isAnchor
                      ? "0 0 8px var(--primary-color)"
                      : (isSelected
                        ? "0 0 4px rgba(var(--primary-rgb), 0.5)"
                        : "none");
                    
                    return (
                      <div
                        key={fKey}
                        onMouseDown={(e) => handleStartMove(e, f)}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setSelectedFieldIds([fKey]);
                          setIsPropertiesExpanded(true);
                        }}
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent background click deselection
                        }}
                        style={{
                          position: "absolute",
                          left: `${f.pdfMapping.x}%`,
                          top: `${f.pdfMapping.y}%`,
                          width: `${f.pdfMapping.width}px`,
                          height: `${f.pdfMapping.height}px`,
                          border: borderStyle,
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
                          boxShadow: shadowStyle
                        }}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: "6px", display: "flex", alignItems: "center" }}>
                          {isAnchor && <span style={{ background: "var(--primary-color)", color: "#fff", fontSize: "7px", padding: "1px 3px", borderRadius: "2px", marginRight: "4px", fontWeight: "extrabold", textTransform: "uppercase" }}>Anchor</span>}
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
