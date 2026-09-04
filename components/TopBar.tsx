"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type User = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "creator";
};

const DEV_USERS = [
  { id: "admin-1", name: "Sarah Admin", email: "admin@wayv.com", role: "admin" as const },
  { id: "admin-2", name: "Tom Admin", email: "admin2@wayv.com", role: "admin" as const },
  { id: "creator-1", name: "Alice Creator", email: "alice@creator.com", role: "creator" as const },
  { id: "creator-2", name: "Bob Creator", email: "bob@creator.com", role: "creator" as const },
  { id: "creator-3", name: "Charlie Creator", email: "charlie@creator.com", role: "creator" as const },
];

export default function TopBar() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/auth/switch")
      .then((r) => r.json())
      .then((d) => {
        const u = d.user as User | null;
        setCurrentUser(u);
        if (u) {
          if (u.role === "creator" && pathname.startsWith("/admin")) {
            window.location.href = "/creator/campaigns";
          } else if (u.role === "admin" && pathname.startsWith("/creator")) {
            window.location.href = "/admin/campaigns";
          }
        }
      });
  }, [pathname]);

  async function switchUser(userId: string) {
    setLoading(true);
    const targetUser = DEV_USERS.find((u) => u.id === userId);
    const res = await fetch("/api/auth/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    setCurrentUser(data.user);
    setShowSwitcher(false);
    setLoading(false);

    if (targetUser?.role === "creator" && pathname.startsWith("/admin")) {
      window.location.href = "/creator/campaigns";
    } else if (targetUser?.role === "admin" && pathname.startsWith("/creator")) {
      window.location.href = "/admin/campaigns";
    } else {
      window.location.reload();
    }
  }

  const isAdmin = currentUser?.role === "admin";

  function navActive(href: string) {
    return pathname.startsWith(href) ? "active" : "";
  }

  return (
    <header className="topbar">
      {/* Logo */}
      <Link href="/" className="topbar-logo">
        <div className="topbar-logo-icon">W</div>
        <span className="topbar-logo-text">
          Wayv <span>Clips</span>
        </span>
      </Link>

      {/* Nav */}
      <nav className="topbar-nav">
        {isAdmin ? (
          <>
            <Link href="/admin/campaigns" className={`nav-link ${navActive("/admin/campaigns")}`}>
              📋 Campaigns
            </Link>
          </>
        ) : currentUser ? (
          <>
            <Link href="/creator/campaigns" className={`nav-link ${navActive("/creator/campaigns")}`}>
              🎯 Browse Campaigns
            </Link>
            <Link href="/creator/submissions" className={`nav-link ${navActive("/creator/submissions")}`}>
              📤 My Submissions
            </Link>
          </>
        ) : null}
      </nav>

      {/* Dev User Switcher */}
      <div className="user-switcher" style={{ position: "relative" }}>
        {currentUser ? (
          <div className="user-badge">
            <div className="user-avatar">
              {currentUser.name.charAt(0)}
            </div>
            <span className="user-name">{currentUser.name.split(" ")[0]}</span>
            <span className={`role-pill ${currentUser.role}`}>
              {currentUser.role}
            </span>
          </div>
        ) : (
          <div className="user-badge" style={{ opacity: 0.6 }}>
            <div className="user-avatar">?</div>
            <span className="user-name">No User</span>
          </div>
        )}

        <button
          id="dev-switcher-btn"
          className="switcher-btn"
          onClick={() => setShowSwitcher(!showSwitcher)}
          disabled={loading}
        >
          ⚡ Dev Switch
        </button>

        {showSwitcher && (
          <div className="switcher-dropdown">
            <div className="switcher-dropdown-header">
              Switch Dev User
            </div>
            {DEV_USERS.map((u) => (
              <button
                key={u.id}
                onClick={() => switchUser(u.id)}
                className={`switcher-dropdown-item ${currentUser?.id === u.id ? "active" : ""}`}
              >
                <div className={`switcher-dropdown-avatar ${u.role}`}>
                  {u.name.charAt(0)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{u.name}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{u.email}</div>
                </div>
                <span className={`role-pill ${u.role}`}>{u.role}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Close dropdown when clicking outside */}
      {showSwitcher && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 299 }}
          onClick={() => setShowSwitcher(false)}
        />
      )}
    </header>
  );
}
