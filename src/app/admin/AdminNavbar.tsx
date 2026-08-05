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
  portalLogoLight: string;
  portalLogoDark: string;
}

export default function AdminNavbar({ user, isGlobalAdmin, portalTitle, portalLogoLight, portalLogoDark }: AdminNavbarProps) {
  const pathname = usePathname();
  const [theme, setTheme] = React.useState<"dark" | "light">("dark");
  const [isOpen, setIsOpen] = React.useState(false);

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
      className="admin-navbar"
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
          width: "100%",
          margin: "0 auto",
          position: "relative",
        }}
      >
        {/* Branding & Links (Left) */}
        <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
          <Link href="/admin" style={{ textDecoration: "none", color: "var(--text-main)", fontWeight: 800, fontSize: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
            {(() => {
              const activeLogo = theme === "light" ? (portalLogoLight || portalLogoDark) : (portalLogoDark || portalLogoLight);
              return activeLogo ? (
                <img
                  src={activeLogo}
                  alt="Logo"
                  style={{ height: "28px", maxWidth: "120px", objectFit: "contain" }}
                />
              ) : null;
            })()}
            <span>{portalTitle}</span>
          </Link>

          {/* Links (Hidden on mobile) */}
          <div className="nav-links-desktop" style={{ display: "flex", gap: "8px" }}>
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
            <Link
              href="/admin/registrations"
              className="btn"
              style={{
                background: isActive("/admin/registrations") ? "rgba(255,255,255,0.06)" : "transparent",
                color: isActive("/admin/registrations") ? "var(--text-main)" : "var(--text-muted)",
                padding: "8px 16px",
                fontSize: "13px",
              }}
            >
              Registrations
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

        {/* Profile info & logout (Desktop-only) */}
        <div className="nav-profile-desktop" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
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
            onClick={() => signOut({ redirect: false }).then(() => {
              window.location.href = "https://auth.server.mtcd.org/application/o/docsign/end-session/?post_logout_redirect_uri=" + encodeURIComponent(window.location.origin + "/");
            })}
            className="btn btn-secondary"
            style={{ padding: "8px 16px", fontSize: "13px" }}
          >
            Sign Out
          </button>
        </div>

        {/* Mobile Hamburger Toggle */}
        <button
          type="button"
          className="nav-hamburger-mobile"
          onClick={() => setIsOpen(!isOpen)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {isOpen ? (
              <line x1="18" y1="6" x2="6" y2="18" />
            ) : (
              <>
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Dropdown Panel */}
      {isOpen && (
        <div
          className="nav-dropdown-mobile"
          style={{
            display: "none",
            flexDirection: "column",
            gap: "12px",
            marginTop: "16px",
            paddingTop: "16px",
            borderTop: "1px solid var(--border-color)",
          }}
        >
          <Link
            href="/admin"
            className="btn"
            onClick={() => setIsOpen(false)}
            style={{
              background: pathname === "/admin" ? "rgba(255,255,255,0.06)" : "transparent",
              color: pathname === "/admin" ? "var(--text-main)" : "var(--text-muted)",
              padding: "10px 16px",
              fontSize: "14px",
              textAlign: "left",
            }}
          >
            Dashboard
          </Link>
          <Link
            href="/admin/templates"
            className="btn"
            onClick={() => setIsOpen(false)}
            style={{
              background: isActive("/admin/templates") ? "rgba(255,255,255,0.06)" : "transparent",
              color: isActive("/admin/templates") ? "var(--text-main)" : "var(--text-muted)",
              padding: "10px 16px",
              fontSize: "14px",
              textAlign: "left",
            }}
          >
            Templates
          </Link>
          <Link
            href="/admin/registrations"
            className="btn"
            onClick={() => setIsOpen(false)}
            style={{
              background: isActive("/admin/registrations") ? "rgba(255,255,255,0.06)" : "transparent",
              color: isActive("/admin/registrations") ? "var(--text-main)" : "var(--text-muted)",
              padding: "10px 16px",
              fontSize: "14px",
              textAlign: "left",
            }}
          >
            Registrations
          </Link>
          {isGlobalAdmin && (
            <Link
              href="/admin/settings"
              className="btn"
              onClick={() => setIsOpen(false)}
              style={{
                background: isActive("/admin/settings") ? "rgba(255,255,255,0.06)" : "transparent",
                color: isActive("/admin/settings") ? "var(--text-main)" : "var(--text-muted)",
                padding: "10px 16px",
                fontSize: "14px",
                textAlign: "left",
              }}
            >
              Settings
            </Link>
          )}

          {/* Profile, Theme, and Signout inside Dropdown */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", marginTop: "8px" }}>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "14px", fontWeight: 600 }}>{user.name || user.email}</div>
              <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                {user.role === "Admin" ? "Global Admin" : "Leader"}
              </span>
            </div>
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
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
          </div>

          <button
            onClick={() => signOut({ redirect: false }).then(() => {
              window.location.href = "https://auth.server.mtcd.org/application/o/docsign/end-session/?post_logout_redirect_uri=" + encodeURIComponent(window.location.origin + "/");
            })}
            className="btn btn-secondary"
            style={{ padding: "12px", fontSize: "14px", marginTop: "4px", color: "#f87171", borderColor: "rgba(239,68,68,0.2)" }}
          >
            Sign Out
          </button>
        </div>
      )}


    </nav>
  );
}
