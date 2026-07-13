"use client";

import { useId, useState } from "react";
import type { UsageRow } from "./mockDashboardData";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";

type UsageTableProps = {
  title: string;
  rows: UsageRow[];
  initialVisibleRows?: number;
};

export function UsageTable({ title, rows, initialVisibleRows }: UsageTableProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const tableId = useId();
  const canCollapse = typeof initialVisibleRows === "number" && rows.length > initialVisibleRows;
  const visibleRows = canCollapse && !isExpanded ? rows.slice(0, initialVisibleRows) : rows;

  return (
    <section className="wm-usage-table" style={styles.card}>
      <h2 style={styles.title}>{title}</h2>
      <div id={tableId} style={styles.table}>
        {rows.length === 0 ? (
          <p style={styles.emptyText}>No usage rows yet. Connect tracking clients and submit app/domain events to populate this section.</p>
        ) : visibleRows.map((row) => (
          <div key={row.name} className="wm-usage-table-row" style={styles.row}>
            <div>
              <p style={styles.name}>{row.name}</p>
              <p style={styles.category}>{row.category}</p>
            </div>
            <strong style={styles.duration}>{row.duration}</strong>
            <span style={styles.share}>{row.share}</span>
          </div>
        ))}
      </div>
      {canCollapse ? (
        <div className="wm-usage-table-toggle" style={styles.toggle}>
          <button
            type="button"
            aria-controls={tableId}
            aria-expanded={isExpanded}
            onClick={() => setIsExpanded((current) => !current)}
            style={styles.toggleButton}
          >
            {isExpanded ? "Show less" : "Show more"}
          </button>
        </div>
      ) : null}
    </section>
  );
}

const styles = {
  card: {
    ...wmStyles.card,
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
    borderTop: `1px solid ${wm.colors.borderSubtle}`,
    paddingTop: "10px",
  },
  name: {
    margin: "0 0 3px",
    fontWeight: 800,
    fontSize: "14px",
  },
  category: {
    margin: 0,
    color: wm.colors.textMuted,
    fontSize: "12px",
  },
  duration: {
    fontSize: "14px",
  },
  share: {
    border: `1px solid ${wm.colors.border}`,
    borderRadius: "999px",
    padding: "4px 8px",
    color: wm.colors.textSecondary,
    fontSize: "12px",
    fontWeight: 800,
  },
  emptyText: {
    margin: 0,
    borderTop: `1px solid ${wm.colors.borderSubtle}`,
    color: wm.colors.textSecondary,
    paddingTop: "10px",
    fontSize: "13px",
    lineHeight: 1.45,
  },
  toggle: {
    display: "flex",
    justifyContent: "flex-start",
    paddingTop: "12px",
  },
  toggleButton: {
    ...wmStyles.secondaryButton,
    minHeight: "38px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 800,
  },
};
