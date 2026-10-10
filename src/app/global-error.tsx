"use client";

/** Last-resort boundary (root layout failed): minimal, self-contained markup. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="pt-PT">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#ffffff", color: "#16130e", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 24 }}>Serviço temporariamente indisponível</h1>
          <p>Tente novamente dentro de momentos.</p>
          <button onClick={reset} style={{ marginTop: 16, padding: "10px 18px", borderRadius: 999, border: 0, background: "#c39b4a", color: "#16130e", fontWeight: 600, cursor: "pointer" }}>
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
