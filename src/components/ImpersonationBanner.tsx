"use client";

import React, { useState } from "react";

interface ImpersonationBannerProps {
  userName: string;
  userEmail: string;
}

export default function ImpersonationBanner({ userName, userEmail }: ImpersonationBannerProps) {
  const [isStopping, setIsStopping] = useState(false);

  const handleStopImpersonation = async () => {
    setIsStopping(true);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        alert("Failed to stop impersonation.");
        setIsStopping(false);
      }
    } catch (e) {
      console.error(e);
      alert("Error stopping impersonation.");
      setIsStopping(false);
    }
  };

  return (
    <div
      style={{
        background: "linear-gradient(90deg, #7c3aed, #4f46e5)",
        color: "#ffffff",
        padding: "10px 24px",
        fontSize: "14px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        zIndex: 9999,
        position: "sticky",
        top: 0,
        fontWeight: 500,
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "16px" }}>👁</span>
        <span>
          Viewing as <strong style={{ textDecoration: "underline" }}>{userName}</strong> ({userEmail})
        </span>
      </div>
      <button
        onClick={handleStopImpersonation}
        disabled={isStopping}
        style={{
          background: "rgba(255, 255, 255, 0.2)",
          border: "1px solid rgba(255, 255, 255, 0.4)",
          color: "#ffffff",
          padding: "4px 12px",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "13px",
          fontWeight: 600,
          transition: "all 0.2s ease",
          outline: "none",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)")}
      >
        {isStopping ? "Stopping..." : "Stop Impersonating"}
      </button>
    </div>
  );
}
