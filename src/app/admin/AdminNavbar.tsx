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
  portalTitle: string;
  portalLogo: string;
}

export default function AdminNavbar({ user, isGlobalAdmin, portalTitle, portalLogo }: AdminNavbarProps) {
  const pathname = usePathname();
  const [theme, setTheme] = React.useState<"dark" | "light">("dark");

  React.useEffect(() => {
    const currentTheme = document.documentElement.getAttribute("data-theme") as "dark" | "light" || "dark";
    setTheme(currentTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("theme-mode", nextTheme);
  };

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
          <Link href="/admin" style={{ textDecoration: "none", color: "var(--text-main)", fontWeight: 800, fontSize: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
            {portalLogo && (
              <img
                src={portalLogo}
                alt="Logo"
                style={{ height: "28px", maxWidth: "120px", objectFit: "contain" }}
              />
            )}
            <span>{portalTitle}</span>
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
          <button
            onClick={toggleTheme}
            className="btn btn-secondary"
            style={{
              padding: "8px",
              borderRadius: "50%",
              width: "36px",
              height: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid var(--border-color)",
              background: "transparent",
            }}
            title="Toggle theme mode"
          >
            {theme === "dark" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-main)" }}>
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-main)" }}>
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          
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
