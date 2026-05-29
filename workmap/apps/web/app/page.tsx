export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#e5e7eb",
        color: "#0f172a",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <section style={{ width: "min(520px, calc(100vw - 32px))" }}>
        <p style={{ margin: 0, color: "#475569", fontSize: "13px", fontWeight: 700, textTransform: "uppercase" }}>
          WorkMap MVP
        </p>
        <h1 style={{ margin: "8px 0 12px", fontSize: "40px", lineHeight: 1 }}>Virtual office</h1>
        <p style={{ margin: "0 0 20px", color: "#334155", lineHeight: 1.5 }}>
          Move a placeholder avatar around the current office map and open lightweight teammate contact actions.
        </p>
        <a
          href="/virtual-office"
          style={{
            display: "inline-flex",
            borderRadius: "8px",
            background: "#0f172a",
            color: "#ffffff",
            padding: "10px 14px",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          Open office
        </a>
      </section>
    </main>
  );
}
