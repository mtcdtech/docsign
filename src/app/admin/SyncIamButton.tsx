"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function SyncIamButton() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    if (!confirm("Are you sure you want to pull the latest user list and organizations from the IAM central registry?")) {
      return;
    }

    setSyncing(true);

    try {
      const res = await fetch("/api/admin/sync-iam", {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "Failed to trigger synchronization.");
      }

      alert(`Synchronization completed!\nAdded: ${data.added}\nUpdated: ${data.updated}\nDeleted: ${data.deleted}`);
      router.refresh();
    } catch (err: any) {
      alert("Error syncing IAM: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <button
      onClick={handleSync}
      disabled={syncing}
      className="btn btn-secondary"
      style={{ width: "auto" }}
    >
      {syncing ? "Syncing Directory..." : "Sync IAM Registry"}
    </button>
  );
}
