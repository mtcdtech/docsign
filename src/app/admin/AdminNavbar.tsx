"use client";

import React from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

interface AdminNavbarProps {
  user: {
    name?: string | null;
    email?: string | null;
    role?: string;
  };
  isGlobalAdmin: boolean;
}

export default function AdminNavbar({ user, isGlobalAdmin }: AdminNavbarProps) {
  const pathname = usePathname();

  const isActive = (path: string) => {
    return pathname === path || pathname?.startsWith(path + "/");
  };

  return (
    <nav
      style={{
        background: "var(--bg-glass)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border-color)",
        position: "sticky",
        top: 0,
        zIndex: 100,
        padding: "16px 24px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        {/* Branding */}
        <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
          <Link href="/admin" style={{ textDecoration: "none", color: "var(--text-main)", fontWeight: 800, fontSize: "20px" }}>
            DocSign Portal
          </Link>

          {/* Links */}
          <div style={{ display: "flex", gap: "8px" }}>
            <Link
              href="/admin"
              className="btn"
              style={{
                background: pathname === "/admin" ? "rgba(255,255,255,0.06)" : "transparent",
                color: pathname === "/admin" ? "var(--text-main)" : "var(--text-muted)",
                padding: "8px 16px",
                fontSize: "13px",
              }}
            >
              Dashboard
            </Link>
            <Link
              href="/admin/templates"
              className="btn"
              style={{
                background: isActive("/admin/templates") ? "rgba(255,255,255,0.06)" : "transparent",
                color: isActive("/admin/templates") ? "var(--text-main)" : "var(--text-muted)",
                padding: "8px 16px",
                fontSize: "13px",
              }}
            >
              Templates
            </Link>
            {isGlobalAdmin && (
              <Link
                href="/admin/settings"
                className="btn"
                style={{
                  background: isActive("/admin/settings") ? "rgba(255,255,255,0.06)" : "transparent",
                  color: isActive("/admin/settings") ? "var(--text-main)" : "var(--text-muted)",
                  padding: "8px 16px",
                  fontSize: "13px",
                }}
              >
                Settings
              </Link>
            )}
          </div>
        </div>

        {/* Profile info & logout */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "14px", fontWeight: 600 }}>{user.name || user.email}</div>
            <span
              style={{
                fontSize: "10px",
                padding: "2px 8px",
                borderRadius: "10px",
                background: user.role === "Admin" ? "rgba(79, 70, 229, 0.2)" : "rgba(255,255,255,0.05)",
                color: user.role === "Admin" ? "#818cf8" : "var(--text-muted)",
                fontWeight: "bold",
                border: "1px solid " + (user.role === "Admin" ? "rgba(79, 70, 229, 0.3)" : "var(--border-color)"),
              }}
            >
              {user.role === "Admin" ? "Global Admin" : "Leader"}
            </span>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="btn btn-secondary"
            style={{ padding: "8px 16px", fontSize: "13px" }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
}
