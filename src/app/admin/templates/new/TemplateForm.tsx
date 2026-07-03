"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface OrgUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface Organization {
  id: string;
  name: string;
  users?: OrgUser[];
}

interface TemplateFormProps {
  organizations: Organization[];
  template?: {
    id: string;
    title: string;
    slug: string;
    emailUser: boolean;
    emailLeader: boolean;
    notificationEmails?: string | null;
    saveSharepoint: boolean;
    sharepointFolderId: string | null;
    sharepointFolderName: string | null;
    organizationId: string;
  };
}

interface SharePointItem {
  id: string;
  name: string;
}

export default function TemplateForm({ organizations, template }: TemplateFormProps) {
  const router = useRouter();
  const isEdit = !!template;

  const [title, setTitle] = useState(template?.title || "");
  const [slug, setSlug] = useState(template?.slug || "");
  const [organizationId, setOrganizationId] = useState(template?.organizationId || organizations[0]?.id || "");
  const [emailUser, setEmailUser] = useState(template?.emailUser ?? true);
  const [emailLeader, setEmailLeader] = useState(template?.emailLeader ?? true);
  const [selectedLeaderEmails, setSelectedLeaderEmails] = useState<string[]>([]);
  const [manualEmails, setManualEmails] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteWaiver = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/templates/${template?.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "Failed to delete waiver template.");
      }
      
      setSuccessModal("Waiver template deleted successfully. Redirecting...");
      setTimeout(() => {
        router.push("/admin/templates");
        router.refresh();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  // Load initial notification emails configurations
  useEffect(() => {
    if (template?.notificationEmails) {
      const emailList = template.notificationEmails.split(",").map((e) => e.trim()).filter(Boolean);
      const currentOrg = organizations.find((o) => o.id === organizationId);
      const orgLeaderEmails = currentOrg?.users
        ?.filter((u) => u.role === "OrgLeader" || u.role === "Admin")
        ?.map((u) => u.email) || [];

      const selectedLeaders: string[] = [];
      const manual: string[] = [];

      emailList.forEach((email) => {
        if (orgLeaderEmails.includes(email)) {
          selectedLeaders.push(email);
        } else {
          manual.push(email);
        }
      });

      setSelectedLeaderEmails(selectedLeaders);
      setManualEmails(manual);
    }
  }, [template, organizationId, organizations]);
  
  // SharePoint States
  const [saveSharepoint, setSaveSharepoint] = useState(template?.saveSharepoint ?? false);
  const [siteSearch, setSiteSearch] = useState("");
  const [sites, setSites] = useState<SharePointItem[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  
  const [drives, setDrives] = useState<SharePointItem[]>([]);
  const [selectedDriveId, setSelectedDriveId] = useState("");
  
  const [folders, setFolders] = useState<SharePointItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState("root");
  const [folderPath, setFolderPath] = useState<{ id: string; name: string }[]>([]);
  
  const [selectedFolderId, setSelectedFolderId] = useState(template?.sharepointFolderId || "");
  const [selectedFolderName, setSelectedFolderName] = useState(template?.sharepointFolderName || "");
  const [successModal, setSuccessModal] = useState<string | null>(null);
  
  const [file, setFile] = useState<File | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-slugify title for convenience
  useEffect(() => {
    if (!isEdit && title) {
      const cleanSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .substring(0, 30);
      setSlug(cleanSlug);
    }
  }, [title, isEdit]);

  // SharePoint Site Search trigger
  const handleSiteSearch = async () => {
    if (!siteSearch.trim()) return;
    try {
      const res = await fetch(`/api/admin/sharepoint/sites?search=${encodeURIComponent(siteSearch)}`);
      const data = await res.json();
      if (data.ok) {
        setSites(data.sites || []);
        if (data.sites.length > 0) {
          setSelectedSiteId(data.sites[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch Drives when Site changes
  useEffect(() => {
    if (!selectedSiteId) return;
    const fetchDrives = async () => {
      try {
        const res = await fetch(`/api/admin/sharepoint/drives?siteId=${encodeURIComponent(selectedSiteId)}`);
        const data = await res.json();
        if (data.ok) {
          setDrives(data.drives || []);
          if (data.drives.length > 0) {
            setSelectedDriveId(data.drives[0].id);
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchDrives();
  }, [selectedSiteId]);

  // Fetch Folders when Drive changes
  useEffect(() => {
    if (!selectedDriveId) return;
    const fetchFolders = async () => {
      try {
        const res = await fetch(`/api/admin/sharepoint/folders?driveId=${encodeURIComponent(selectedDriveId)}&folderId=${currentFolderId}`);
        const data = await res.json();
        if (data.ok) {
          setFolders(data.folders || []);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchFolders();
  }, [selectedDriveId, currentFolderId]);

  const enterFolder = (folder: SharePointItem) => {
    setCurrentFolderId(folder.id);
    setFolderPath((prev) => [...prev, { id: folder.id, name: folder.name }]);
  };

  const navigateBreadcrumb = (index: number) => {
    if (index === -1) {
      setCurrentFolderId("root");
      setFolderPath([]);
    } else {
      const target = folderPath[index];
      setCurrentFolderId(target.id);
      setFolderPath(folderPath.slice(0, index + 1));
    }
  };

  const selectCurrentFolder = () => {
    const parentId = selectedDriveId;
    const folderId = currentFolderId;
    const combinedId = `${parentId}/${folderId}`;
    
    let pathLabel = "Document Library Root";
    if (folderPath.length > 0) {
      pathLabel = folderPath.map((f) => f.name).join(" / ");
    }
    
    setSelectedFolderId(combinedId);
    setSelectedFolderName(pathLabel);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const notificationEmailsList = [
      ...selectedLeaderEmails,
      ...manualEmails.map((m) => m.trim()).filter(Boolean)
    ];
    const notificationEmails = notificationEmailsList.join(",");

    try {
      if (isEdit) {
        const res = await fetch(`/api/admin/templates/${template!.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            emailUser,
            emailLeader,
            notificationEmails,
            saveSharepoint,
            sharepointFolderId: selectedFolderId || null,
            sharepointFolderName: selectedFolderName || null,
          }),
        });

        const data = await res.json();
        if (!res.ok || data.ok === false) {
          throw new Error(data.error || "Failed to update template.");
        }

        setSuccessModal("Template configuration updated successfully! Redirecting...");
        setTimeout(() => {
          router.push("/admin/templates");
          router.refresh();
        }, 1500);
      } else {
        if (!file) {
          throw new Error("Please upload a template file (PDF or Word DOCX).");
        }

        const formData = new FormData();
        formData.append("title", title);
        formData.append("slug", slug);
        formData.append("organizationId", organizationId);
        formData.append("emailUser", String(emailUser));
        formData.append("emailLeader", String(emailLeader));
        formData.append("notificationEmails", notificationEmails);
        formData.append("saveSharepoint", String(saveSharepoint));
        formData.append("sharepointFolderId", selectedFolderId);
        formData.append("sharepointFolderName", selectedFolderName);
        formData.append("file", file);

        const res = await fetch("/api/admin/templates", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || data.ok === false) {
          throw new Error(data.error || "Failed to create template.");
        }

        setSuccessModal("Template created successfully! Redirecting to visual fields designer...");
        setTimeout(() => {
          router.push(`/admin/templates/${data.templateId}/design`);
          router.refresh();
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card-glass" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div className="form-group">
        <label className="form-label">Template Title</label>
        <input
          type="text"
          className="form-input"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Youth Camp Registration & Liability Release"
        />
      </div>

      <div className="form-group">
        <label className="form-label">Public Access Link Slug</label>
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ color: "var(--text-muted)", fontSize: "14px", marginRight: "4px" }}>/sign/</span>
          <input
            type="text"
            className="form-input"
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            placeholder="youth-camp-liability"
            style={{ flex: 1 }}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Assigned Church Organization</label>
        <select
          className="form-input"
          required
          disabled={isEdit}
          value={organizationId}
          onChange={(e) => setOrganizationId(e.target.value)}
          style={{ background: "rgba(0,0,0,0.4)" }}
        >
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </div>

      <h3 style={{ marginTop: "12px", borderTop: "1px solid var(--border-color)", paddingTop: "20px" }}>Integration Options</h3>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", color: "var(--text-main)", fontSize: "14px" }}>
          <input
            type="checkbox"
            checked={emailUser}
            onChange={(e) => setEmailUser(e.target.checked)}
            style={{ width: "18px", height: "18px", accentColor: "var(--primary-color)" }}
          />
          Email completed copy to Signer
        </label>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", color: "var(--text-main)", fontSize: "14px" }}>
            <input
              type="checkbox"
              checked={emailLeader}
              onChange={(e) => setEmailLeader(e.target.checked)}
              style={{ width: "18px", height: "18px", accentColor: "var(--primary-color)" }}
            />
            Email completed copy to Custom List (Leaders / External Emails)
          </label>

          {emailLeader && (() => {
            const currentOrg = organizations.find((o) => o.id === organizationId);
            const orgLeaders = currentOrg?.users?.filter((u) => u.role === "OrgLeader" || u.role === "Admin") || [];
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", background: "rgba(0,0,0,0.15)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border-color)", marginTop: "4px", marginLeft: "28px" }}>
                <label className="form-label" style={{ fontSize: "13px", margin: 0 }}>Select Org Leaders to notify:</label>
                {orgLeaders.length === 0 ? (
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>No leaders mapped to this organization.</span>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {orgLeaders.map((u) => {
                      const isChecked = selectedLeaderEmails.includes(u.email);
                      return (
                        <label key={u.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLeaderEmails((prev) => [...prev, u.email]);
                              } else {
                                setSelectedLeaderEmails((prev) => prev.filter((email) => email !== u.email));
                              }
                            }}
                            style={{ accentColor: "var(--primary-color)" }}
                          />
                          {u.name || u.email} ({u.role})
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* Manual Email Entries */}
                <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "12px", marginTop: "4px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <label className="form-label" style={{ fontSize: "13px", margin: 0 }}>Additional Recipient Emails:</label>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setManualEmails((prev) => [...prev, ""])}
                      style={{ padding: "2px 8px", fontSize: "11px", height: "24px", width: "auto" }}
                    >
                      + Add Email
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {manualEmails.map((email, index) => (
                      <div key={index} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <input
                          type="email"
                          className="form-input"
                          value={email}
                          onChange={(e) => {
                            const updated = [...manualEmails];
                            updated[index] = e.target.value;
                            setManualEmails(updated);
                          }}
                          placeholder="recipient@example.com"
                          style={{ flex: 1, padding: "6px 12px", fontSize: "13px" }}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setManualEmails((prev) => prev.filter((_, idx) => idx !== index))}
                          style={{ padding: "0", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444" }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", color: "var(--text-main)", fontSize: "14px" }}>
          <input
            type="checkbox"
            checked={saveSharepoint}
            onChange={(e) => setSaveSharepoint(e.target.checked)}
            style={{ width: "18px", height: "18px", accentColor: "var(--primary-color)" }}
          />
          Upload finalized PDF to SharePoint Folder
        </label>
      </div>

      {saveSharepoint && (
        <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-color)", padding: "16px", borderRadius: "8px", marginTop: "8px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <h4>SharePoint Folder Configuration</h4>
          
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Search SharePoint Site (Site Name)</label>
            <div style={{ display: "flex", gap: "10px" }}>
              <input
                type="text"
                className="form-input"
                value={siteSearch}
                onChange={(e) => setSiteSearch(e.target.value)}
                placeholder="e.g. Carrollton Church"
                style={{ flex: 1 }}
              />
              <button type="button" onClick={handleSiteSearch} className="btn btn-secondary" style={{ width: "auto" }}>
                Search Site
              </button>
            </div>
          </div>

          {sites.length > 0 && (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Select Site</label>
              <select
                className="form-input"
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                style={{ background: "rgba(0,0,0,0.4)" }}
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {drives.length > 0 && (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Select Document Library (Drive)</label>
              <select
                className="form-input"
                value={selectedDriveId}
                onChange={(e) => setSelectedDriveId(e.target.value)}
                style={{ background: "rgba(0,0,0,0.4)" }}
              >
                {drives.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedDriveId && (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Navigate Folders</label>
              <div style={{ padding: "12px", background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-color)", borderRadius: "6px" }}>
                {/* Breadcrumbs */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", fontSize: "12px", marginBottom: "12px", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                  <span onClick={() => navigateBreadcrumb(-1)} style={{ color: "var(--primary-color)", cursor: "pointer" }}>Root</span>
                  {folderPath.map((f, i) => (
                    <React.Fragment key={f.id}>
                      <span style={{ color: "var(--text-muted)" }}>/</span>
                      <span onClick={() => navigateBreadcrumb(i)} style={{ color: "var(--primary-color)", cursor: "pointer" }}>{f.name}</span>
                    </React.Fragment>
                  ))}
                </div>

                {/* Subfolders list */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "160px", overflowY: "auto", paddingRight: "4px" }}>
                  {folders.length === 0 ? (
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", padding: "10px" }}>No subfolders found.</div>
                  ) : (
                    folders.map((f) => (
                      <div
                        key={f.id}
                        onClick={() => enterFolder(f)}
                        style={{ padding: "8px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-color)", borderRadius: "4px", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center" }}
                      >
                        📁 {f.name}
                      </div>
                    ))
                  )}
                </div>

                {/* Confirm selection */}
                <button
                  type="button"
                  onClick={selectCurrentFolder}
                  className="btn btn-primary"
                  style={{ width: "100%", padding: "10px", fontSize: "12px", marginTop: "12px" }}
                >
                  Select Current Folder
                </button>
              </div>
            </div>
          )}

          {selectedFolderName && (
            <div style={{ fontSize: "13px", color: "#22c55e", fontWeight: "bold" }}>
              Selected folder: {selectedFolderName}
            </div>
          )}
        </div>
      )}

      {!isEdit && (
        <div className="form-group" style={{ borderTop: "1px solid var(--border-color)", paddingTop: "20px" }}>
          <label className="form-label">Base Template Document (PDF or Word DOCX)</label>
          <input
            type="file"
            accept="application/pdf,.docx,.doc"
            className="form-input"
            required
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={{ background: "rgba(0,0,0,0.4)" }}
          />
          <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            Upload a clean PDF or Word document. Word documents will be automatically converted to PDF for mapping.
          </span>
        </div>
      )}

      {error && (
        <div style={{ color: "#ef4444", fontSize: "14px", fontWeight: "bold", background: "rgba(239, 68, 68, 0.1)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ display: "flex", gap: "12px", justifyContent: "space-between", borderTop: "1px solid var(--border-color)", paddingTop: "20px" }}>
        <div>
          {isEdit && (
            <button
              type="button"
              className="btn"
              onClick={() => setShowDeleteConfirm(true)}
              style={{
                width: "auto",
                background: "rgba(239, 68, 68, 0.12)",
                color: "#f87171",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                padding: "10px 18px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                borderRadius: "6px"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(239, 68, 68, 0.22)";
                e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(239, 68, 68, 0.12)";
                e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.25)";
              }}
            >
              🗑 Delete Waiver
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            type="button"
            onClick={() => router.push("/admin/templates")}
            className="btn btn-secondary"
            style={{ width: "auto" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: "auto" }}
          >
            {loading ? "Processing..." : isEdit ? "Save Configuration" : "Upload & Design Fields"}
          </button>
        </div>
      </div>

      {showDeleteConfirm && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div className="card-glass" style={{ width: "450px", padding: "24px", display: "flex", flexDirection: "column", gap: "20px", textAlign: "center" }}>
            <div style={{ fontSize: "36px" }}>⚠️</div>
            <div>
              <h3 style={{ margin: "0 0 8px 0", color: "#f87171", fontSize: "18px", fontWeight: "bold" }}>Delete Waiver Template</h3>
              <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)", lineHeight: "1.5" }}>
                Are you absolutely sure you want to delete <strong>{template?.title}</strong>? This action cannot be undone and will permanently remove this waiver template and all associated signed logs.
              </p>
            </div>
            
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "8px" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowDeleteConfirm(false)}
                style={{ width: "auto", minWidth: "100px" }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                disabled={deleting}
                onClick={handleDeleteWaiver}
                style={{
                  width: "auto",
                  minWidth: "120px",
                  background: "#ef4444",
                  color: "#ffffff",
                  fontWeight: "bold",
                  cursor: "pointer",
                  borderRadius: "6px"
                }}
              >
                {deleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {successModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div className="card-glass" style={{ width: "400px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", textAlign: "center" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "bold", color: "var(--primary-color)" }}>Success</h3>
            <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)", lineHeight: "1.5" }}>{successModal}</p>
          </div>
        </div>
      )}
    </form>
  );
}
