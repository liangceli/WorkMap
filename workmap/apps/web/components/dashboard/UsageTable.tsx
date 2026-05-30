import type { UsageRow } from "./mockDashboardData";

type UsageTableProps = {
  title: string;
  rows: UsageRow[];
};

export function UsageTable({ title, rows }: UsageTableProps) {
  return (
    <section style={styles.card}>
      <h2 style={styles.title}>{title}</h2>
      <div style={styles.table}>
        {rows.map((row) => (
          <div key={row.name} style={styles.row}>
            <div>
              <p style={styles.name}>{row.name}</p>
              <p style={styles.category}>{row.category}</p>
            </div>
            <strong style={styles.duration}>{row.duration}</strong>
            <span style={styles.share}>{row.share}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

const styles = {
  card: {
    border: "1px solid #dbe3ef",
    borderRadius: "8px",
    background: "#ffffff",
    padding: "16px",
  },
  title: {
    margin: "0 0 12px",
    fontSize: "18px",
  },
  table: {
    display: "grid",
    gap: "8px",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto auto",
    gap: "12px",
    alignItems: "center",
    borderTop: "1px solid #eef2f7",
    paddingTop: "10px",
  },
  name: {
    margin: "0 0 3px",
    fontWeight: 800,
    fontSize: "14px",
  },
  category: {
    margin: 0,
    color: "#64748b",
    fontSize: "12px",
  },
  duration: {
    fontSize: "14px",
  },
  share: {
    border: "1px solid #dbe3ef",
    borderRadius: "999px",
    padding: "4px 8px",
    color: "#475569",
    fontSize: "12px",
    fontWeight: 800,
  },
};
