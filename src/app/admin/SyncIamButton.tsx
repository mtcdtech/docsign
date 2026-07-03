"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function SyncIamButton() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<{ added: number; updated: number; deleted: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSync = async () => {
    setShowConfirm(false);
    setSyncing(true);
    setErrorMsg(null);
    setResult(null);

    try {
      const res = await fetch("/api/admin/sync-iam", {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "Failed to trigger synchronization.");
      }

      setResult({
        added: data.added || 0,
        updated: data.updated || 0,
        deleted: data.deleted || 0,
      });
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to sync directory from registry.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        disabled={syncing}
        className="btn btn-secondary"
        style={{ width: "auto" }}
      >
        {syncing ? "Syncing Directory..." : "Sync IAM Registry"}
      </button>

      {/* Custom Confirmation Dialog Overlay */}
      {showConfirm && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div className="card-glass" style={{ width: "420px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "bold" }}>Trigger Directory Sync</h3>
            <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)", lineHeight: "1.5" }}>
              Are you sure you want to pull the latest user list and organizations from the Central IAM Registry? This will update local directory database schemas dynamically.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setShowConfirm(false)} style={{ width: "auto" }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSync} style={{ width: "auto" }}>
                Confirm Sync
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Result Dialog Overlay */}
      {result && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div className="card-glass" style={{ width: "420px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "bold", color: "#10b981" }}>Sync Successful</h3>
            <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)", lineHeight: "1.5" }}>
              The directory synchronizer has completed successfully:
            </p>
            <div style={{ background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: "6px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px" }}>
              <div>🆕 Added: <strong>{result.added}</strong> users</div>
              <div>🔄 Updated: <strong>{result.updated}</strong> users</div>
              <div>❌ Deleted: <strong>{result.deleted}</strong> users</div>
            </div>
            <button className="btn btn-primary" onClick={() => setResult(null)} style={{ alignSelf: "flex-end", width: "auto", minWidth: "80px" }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Custom Error Dialog Overlay */}
      {errorMsg && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div className="card-glass" style={{ width: "400px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "bold", color: "#ef4444" }}>Sync Error</h3>
            <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)", lineHeight: "1.5" }}>{errorMsg}</p>
            <button className="btn btn-primary" onClick={() => setErrorMsg(null)} style={{ alignSelf: "flex-end", width: "auto", minWidth: "80px" }}>
              OK
            </button>
          </div>
        </div>
      )}
    </>
  );
}
