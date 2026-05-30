"use client";

type MovementHintProps = {
  hasInteractionTarget: boolean;
};

export function MovementHint({ hasInteractionTarget }: MovementHintProps) {
  return (
    <div style={{ ...styles.hint, bottom: hasInteractionTarget ? "198px" : "24px" }}>
      <span style={styles.icon}>Move</span>
      <span>
        Use <strong>WASD</strong> or arrow keys to move
      </span>
    </div>
  );
}

const styles = {
  hint: {
    position: "absolute" as const,
    left: "50%",
    zIndex: 18,
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    maxWidth: "calc(100vw - 48px)",
    padding: "10px 14px",
    border: "1px solid rgba(30, 41, 59, 0.12)",
    borderRadius: "12px",
    background: "rgba(15, 23, 42, 0.78)",
    color: "#f8fafc",
    boxShadow: "0 16px 35px rgba(15, 23, 42, 0.2)",
    backdropFilter: "blur(14px)",
    fontSize: "13px",
    fontWeight: 600,
    transform: "translateX(-50%)",
    transition: "bottom 160ms ease",
    whiteSpace: "nowrap" as const,
  },
  icon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "42px",
    height: "24px",
    borderRadius: "999px",
    background: "rgba(255, 255, 255, 0.13)",
    color: "#ffffff",
    fontSize: "11px",
    fontWeight: 800,
    textTransform: "uppercase" as const,
  },
};
