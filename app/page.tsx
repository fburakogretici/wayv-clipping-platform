import Link from "next/link";

export default function HomePage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        textAlign: "center",
        gap: "2rem",
      }}
    >
      {/* Hero */}
      <div
        style={{
          width: 80,
          height: 80,
          background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
          borderRadius: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 36,
          fontWeight: 800,
          color: "white",
          boxShadow: "0 0 40px rgba(139, 92, 246, 0.3)",
        }}
      >
        W
      </div>
      <div>
        <h1
          style={{
            fontSize: "2.25rem",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            color: "var(--text-primary)",
            lineHeight: 1.1,
            marginBottom: "0.75rem",
          }}
        >
          Wayv Clipping Platform
        </h1>
        <p
          style={{
            fontSize: "1.0625rem",
            color: "var(--text-secondary)",
            maxWidth: 480,
            lineHeight: 1.6,
          }}
        >
          A marketplace where brands run paid clipping campaigns and creators
          earn per 1,000 views on TikTok, Instagram and YouTube.
        </p>
      </div>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
        <Link href="/admin/campaigns" className="btn btn-primary">
          📋 Admin Dashboard
        </Link>
        <Link href="/creator/campaigns" className="btn btn-secondary">
          🎯 Creator Dashboard
        </Link>
      </div>

      <div
        style={{
          background: "rgba(245, 158, 11, 0.08)",
          border: "1px solid rgba(245, 158, 11, 0.2)",
          borderRadius: 10,
          padding: "0.875rem 1.25rem",
          fontSize: "0.8125rem",
          color: "#fbbf24",
          maxWidth: 480,
        }}
      >
        ⚡ <strong>Dev Mode:</strong> Use the &ldquo;Dev Switch&rdquo; button in the top right to
        switch between Admin and Creator personas.
      </div>
    </div>
  );
}
