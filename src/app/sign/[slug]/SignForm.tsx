"use client";

import React, { useState } from "react";
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
  type: "text" | "date" | "number" | "checkbox" | "signature";
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
}

export default function SignForm({ template }: SignFormProps) {
  const fields = JSON.parse(template.fieldsJson) as FormField[];
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);

  // Age Calculator
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

  // Evaluate if a field is visible based on conditional logic
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
      const val = formData[f.id];
      if (f.required && (val === undefined || val === null || val === "")) {
        setSubmitError(`Please fill out the required field: ${f.label}`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/sign/${template.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signerName,
          signerEmail,
          formData,
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
      <div className="card-glass" style={{ maxWidth: "600px", margin: "40px auto", textAlign: "center" }}>
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
    <div className="card-glass" style={{ maxWidth: "600px", margin: "40px auto" }}>
      <div style={{ marginBottom: "24px", borderBottom: "1px solid var(--border-color)", paddingBottom: "16px" }}>
        <span style={{ fontSize: "12px", color: "var(--primary-color)", fontWeight: "bold", textTransform: "uppercase" }}>
          {template.organization.name}
        </span>
        <h2 style={{ marginTop: "4px" }}>{template.title}</h2>
        <p style={{ fontSize: "14px", marginTop: "8px" }}>
          Please fill out the questionnaire below and sign at the bottom.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <h3>1. Signer Information</h3>
        <div className="dashboard-grid" style={{ gap: "16px" }}>
          <div className="form-group">
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
          <div className="form-group">
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

        {fields.length > 0 && (
          <>
            <h3 style={{ borderTop: "1px solid var(--border-color)", paddingTop: "20px" }}>2. Document Questionnaire</h3>
            {fields.map((field) => {
              if (!isFieldVisible(field)) return null;

              return (
                <div key={field.id} className="form-group">
                  <label className="form-label">
                    {field.label} {field.required ? "*" : ""}
                  </label>

                  {field.type === "signature" ? (
                    <SignaturePad
                      onChange={(val) => handleInputChange(field.id, val)}
                    />
                  ) : field.type === "checkbox" ? (
                    <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", color: "var(--text-muted)", fontSize: "14px" }}>
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
          </>
        )}

        {submitError && (
          <div style={{ color: "#ef4444", fontSize: "14px", fontWeight: "bold", background: "rgba(239, 68, 68, 0.1)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
            ⚠️ {submitError}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSubmitting}
          style={{ padding: "16px", marginTop: "12px" }}
        >
          {isSubmitting ? "Generating Document..." : "Submit & Sign Document"}
        </button>
      </form>
    </div>
  );
}

