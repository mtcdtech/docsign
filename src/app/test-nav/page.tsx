"use client";

import React, { useEffect, useState } from "react";
import AdminNavbar from "../admin/AdminNavbar";

export default function TestNavPage() {
  const user = { name: "Test User", email: "test@example.com", role: "Admin" };
  const [metrics, setMetrics] = useState<any>(null);
  const [windowWidth, setWindowWidth] = useState(0);

  useEffect(() => {
    function updateMetrics() {
      setWindowWidth(window.innerWidth);
      
      const nav = document.querySelector('.admin-navbar');
      const container = document.querySelector('.mobile-flex-only');
      const brand = document.querySelector('.mobile-flex-only a');
      const button = document.querySelector('.mobile-flex-only button');

      const getRect = (el: Element | null) => {
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return {
          width: rect.width.toFixed(1),
          height: rect.height.toFixed(1),
          left: rect.left.toFixed(1),
          right: rect.right.toFixed(1),
          display: style.display,
          position: style.position,
          flexDirection: style.flexDirection,
          justifyContent: style.justifyContent
        };
      };

      setMetrics({
        nav: getRect(nav),
        container: getRect(container),
        brand: getRect(brand),
        button: getRect(button)
      });
    }

    window.addEventListener('resize', updateMetrics);
    // Extra timeout to allow layout compilation settle
    const timer = setTimeout(updateMetrics, 1000);

    return () => {
      window.removeEventListener('resize', updateMetrics);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-app)", position: "relative" }}>
      <AdminNavbar
        user={user}
        isGlobalAdmin={true}
        portalTitle="DocSign Portal"
        portalLogoLight=""
        portalLogoDark=""
      />
      
      <div style={{ padding: "40px 20px" }}>
        <h1>Navbar Responsive Debugger</h1>
        <p>Resize your browser window and watch the dimensions change below.</p>
        
        {metrics && (
          <div style={{
            marginTop: "30px",
            padding: "20px",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
            fontFamily: "monospace",
            maxWidth: "600px",
            fontSize: "13px",
            lineHeight: "1.6"
          }}>
            <h3 style={{ margin: "0 0 15px 0" }}>Live Layout Dimensions</h3>
            <div><strong>Viewport Width:</strong> {windowWidth}px</div>
            <hr style={{ border: "none", borderTop: "1px solid var(--border-color)", margin: "12px 0" }} />
            
            <div><strong>1. Navbar (<code>.admin-navbar</code>):</strong></div>
            <pre style={{ margin: "4px 0 12px 20px" }}>{JSON.stringify(metrics.nav, null, 2)}</pre>
            
            <div><strong>2. Mobile Container (<code>.mobile-flex-only</code>):</strong></div>
            <pre style={{ margin: "4px 0 12px 20px" }}>{JSON.stringify(metrics.container, null, 2)}</pre>
            
            <div><strong>3. Brand Link:</strong></div>
            <pre style={{ margin: "4px 0 12px 20px" }}>{JSON.stringify(metrics.brand, null, 2)}</pre>
            
            <div><strong>4. Hamburger Button:</strong></div>
            <pre style={{ margin: "4px 0 4px 20px" }}>{JSON.stringify(metrics.button, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
