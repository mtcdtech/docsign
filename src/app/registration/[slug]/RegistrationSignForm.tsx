"use client";

import React, { useState } from "react";
import SignForm from "@/app/sign/[slug]/SignForm";

interface TemplateWithOrg {
  id: string;
  title: string;
  slug: string;
  pdfPath: string;
  fieldsJson: string;
  emailUser: boolean;
  emailLeader: boolean;
  notificationEmails?: string | null;
  saveSharepoint?: boolean;
  sharepointFolderName?: string | null;
  organization: {
    name: string;
    logoLight?: string | null;
    logoDark?: string | null;
  };
}

interface RegistrationSignFormProps {
  registration: {
    id: string;
    title: string;
    slug: string;
    organizationName?: string;
  };
  templates: TemplateWithOrg[];
  portalTitle: string;
  portalLogoLight: string;
  portalLogoDark: string;
  orgLogoLight: string | null;
  orgLogoDark: string | null;
  pcoAttendeeId: string | null;
}

interface CompletedDocument {
  title: string;
  pdfUrl: string;
}

export default function RegistrationSignForm({
  registration,
  templates,
  portalTitle,
  portalLogoLight,
  portalLogoDark,
  orgLogoLight,
  orgLogoDark,
  pcoAttendeeId
}: RegistrationSignFormProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedDocs, setCompletedDocs] = useState<CompletedDocument[]>([]);
  const [savedName, setSavedName] = useState("");
  const [savedEmail, setSavedEmail] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const activeTemplate = templates[currentIndex];
  const isFinished = currentIndex >= templates.length;

  const handleDocComplete = (pdfUrl: string, completedDocId: string, name: string, email: string) => {
    setCompletedDocs((prev) => [...prev, { title: activeTemplate.title, pdfUrl }]);
    setSavedName(name);
    setSavedEmail(email);
    setCurrentIndex((prev) => prev + 1);
  };

  if (isFinished) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh", padding: "20px" }}>
        <div className="card-glass" style={{ maxWidth: "560px", width: "100%", padding: "40px", textAlign: "center", display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Success Checkmark */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              background: "rgba(16, 185, 129, 0.15)",
              border: "2px solid #10b981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "36px",
              color: "#34d399",
            }}>
              ✓
            </div>
          </div>

          <div>
            <h2 style={{ margin: 0, fontSize: "24px", fontWeight: "bold" }}>Registration Completed!</h2>
            <p style={{ margin: "8px 0 0 0", fontSize: "14px", color: "var(--text-muted)", lineHeight: "1.6" }}>
              All documents in this packet have been successfully signed and submitted.
            </p>
          </div>

          <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "16px", display: "flex", flexDirection: "column", gap: "12px", textAlign: "left" }}>
            <h3 style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>Signed Documents</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {completedDocs.map((doc, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    background: "rgba(255, 255, 255, 0.02)",
                    borderRadius: "6px",
                    border: "1px solid var(--border-color)"
                  }}
                >
                  <span style={{ fontSize: "13px", fontWeight: "500", color: "var(--text-main)" }}>
                    📄 {doc.title}
                  </span>
                  <a
                    href={doc.pdfUrl}
                    download
                    className="btn btn-secondary"
                    style={{
                      width: "auto",
                      padding: "6px 14px",
                      fontSize: "12px",
                      background: "rgba(255,255,255,0.03)",
                      borderColor: "var(--border-color)",
                      color: "var(--text-main)",
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    }}
                  >
                    📥 Download
                  </a>
                </div>
              ))}
            </div>
          </div>

          <a href="/" className="btn" style={{ background: "var(--primary-color)", color: "#ffffff", padding: "12px", fontWeight: "600" }}>
            Finish & Return Home
          </a>
        </div>
      </div>
    );
  }

  // Active document PDF template path download helper
  const pdfFilename = activeTemplate.pdfPath.split("/").pop();
  const pdfUrl = `/api/download/templates/${pdfFilename}`;

  return (
    <div className="registration-main-container">
      
      {/* Logos Switcher (Light / Dark mode, Org priority, Portal fallback) */}
      <div className="logo-header-container mobile-hider" style={{ display: "flex", justifyContent: "center", marginBottom: "4px" }}>
        {/* Light Mode Logos */}
        <div className="logo-light-mode">
          {orgLogoLight ? (
            <img src={orgLogoLight} alt={registration.organizationName || "Logo"} style={{ maxHeight: "60px", maxWidth: "240px", objectFit: "contain" }} />
          ) : portalLogoLight ? (
            <img src={portalLogoLight} alt={portalTitle} style={{ maxHeight: "60px", maxWidth: "240px", objectFit: "contain" }} />
          ) : (
            <div style={{ fontSize: "20px", fontWeight: "bold", color: "#18181b" }}>✍️ {portalTitle}</div>
          )}
        </div>

        {/* Dark Mode Logos */}
        <div className="logo-dark-mode">
          {orgLogoDark ? (
            <img src={orgLogoDark} alt={registration.organizationName || "Logo"} style={{ maxHeight: "60px", maxWidth: "240px", objectFit: "contain" }} />
          ) : portalLogoDark ? (
            <img src={portalLogoDark} alt={portalTitle} style={{ maxHeight: "60px", maxWidth: "240px", objectFit: "contain" }} />
          ) : (
            <div style={{ fontSize: "20px", fontWeight: "bold", color: "#ffffff" }}>✍️ {portalTitle}</div>
          )}
        </div>
      </div>

      {/* Registration Title Header */}
      <div className="registration-title-header mobile-hider" style={{ textAlign: "center", marginBottom: "10px" }}>
        <h1 style={{ fontSize: "24px", margin: "0 0 6px 0", fontWeight: "800" }}>{registration.title}</h1>
        <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>
          Step {currentIndex + 1} of {templates.length} — Completing: <strong>{activeTemplate.title}</strong>
        </p>
      </div>

      {/* Progress Wizard Breadcrumb Steps */}
      <div className="progress-wizard-container mobile-hider">
        <span className="mobile-only" style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "bold", marginRight: "4px" }}>
          Packet:
        </span>
        {templates.map((tpl, index) => {
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;
          return (
            <div key={tpl.id} style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
              <div 
                className="progress-step-pill"
                style={{
                  background: isActive ? "var(--primary-color)" : isCompleted ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.03)",
                  color: isActive ? "#ffffff" : isCompleted ? "#34d399" : "var(--text-muted)",
                  border: "1px solid " + (isActive ? "var(--primary-color)" : isCompleted ? "#10b981" : "var(--border-color)"),
                }}
              >
                {isCompleted && <span>✓</span>}
                <span>
                  {index + 1}
                  <span className="mobile-hider">. {tpl.title}</span>
                </span>
              </div>
              {index < templates.length - 1 && <span className="arrow-step-divider">➔</span>}
            </div>
          );
        })}
      </div>

      {/* Mount individual SignForm */}
      <SignForm
        key={activeTemplate.id}
        template={activeTemplate}
        portalTitle={portalTitle}
        portalLogoLight={portalLogoLight}
        portalLogoDark={portalLogoDark}
        orgLogoLight={orgLogoLight}
        orgLogoDark={orgLogoDark}
        pdfUrl={pdfUrl}
        pcoAttendeeId={pcoAttendeeId}
        defaultSignerName={savedName}
        defaultSignerEmail={savedEmail}
        onComplete={handleDocComplete}
        wizardStepsCount={templates.length}
        wizardCurrentIndex={currentIndex}
      />

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (prefers-color-scheme: dark) {
              .logo-light-mode { display: none !important; }
              .logo-dark-mode { display: block !important; }
            }
            @media (prefers-color-scheme: light) {
              .logo-light-mode { display: block !important; }
              .logo-dark-mode { display: none !important; }
            }
            @media (max-width: 768px) {
              .logo-header-container {
                display: none !important;
              }
              .registration-title-header h1 {
                font-size: 16px !important;
                margin-bottom: 2px !important;
              }
              .progress-wizard-container {
                flex-wrap: nowrap !important;
                justify-content: flex-start !important;
                overflow-x: auto !important;
                padding: 8px 4px !important;
                width: 100% !important;
                -webkit-overflow-scrolling: touch;
              }
              .progress-wizard-container::-webkit-scrollbar {
                height: 4px;
              }
              .progress-wizard-container::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.15);
                border-radius: 2px;
              }
            }
          `,
        }}
      />
    </div>
  );
}
