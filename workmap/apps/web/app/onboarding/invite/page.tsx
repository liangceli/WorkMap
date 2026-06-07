"use client";

import { useEffect, useState } from "react";
import { createInvitation, listInvitations } from "../../../lib/api/invitationsApi";
import { getWorkMapApiAuthOptions, type WorkMapApiAuthResult } from "../../../lib/api/apiAuth";
import type { WorkMapApiInvitation } from "../../../lib/api/apiTypes";
import { AppShell } from "../../../components/layout/AppShell";
import { wm, wmStyles } from "../../../lib/theme/workmapTheme";

const roles = [
  ["EMPLOYEE", "Employee"],
  ["TEAM_LEAD", "Team lead"],
  ["MANAGER", "Manager"],
  ["HR_ADMIN", "HR admin"],
  ["IT_ADMIN", "IT admin"],
] as const;

export default function OwnerInvitePage() {
  const [auth, setAuth] = useState<WorkMapApiAuthResult | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("EMPLOYEE");
  const [status, setStatus] = useState("Loading invitations...");
  const [inviteLink, setInviteLink] = useState("");
  const [invitations, setInvitations] = useState<WorkMapApiInvitation[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const authResult = await getWorkMapApiAuthOptions();

      if (cancelled) {
        return;
      }

      setAuth(authResult);

      if (!authResult.available) {
        setStatus(authResult.reason);
        return;
      }

      const result = await listInvitations(authResult.options);

      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setStatus(result.error);
        return;
      }

      setInvitations(result.data.invitations);
      setStatus("");
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const submitInvite = async () => {
    if (!auth?.available) {
      setStatus("Sign in as an owner before creating invitations.");
      return;
    }

    setSubmitting(true);
    setStatus("");
    setInviteLink("");

    const result = await createInvitation({ email, role }, auth.options);
    setSubmitting(false);

    if (!result.ok) {
      setStatus(result.error);
      return;
    }

    setInviteLink(result.data.inviteLink);
    setInvitations((current) => [result.data.invitation, ...current]);
    setEmail("");
    setStatus("Invitation created.");
  };

  return (
    <AppShell>
      <section style={styles.shell}>
        <div style={styles.header}>
          <p style={styles.eyebrow}>Owner onboarding</p>
          <h1 style={styles.title}>Invite employees</h1>
          <p style={styles.subtitle}>Create tenant-scoped invitation links for employees to join this WorkMap workspace.</p>
        </div>

        <section style={styles.panel}>
          <label style={styles.label}>
            <span>Employee email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} style={styles.input} />
          </label>
          <label style={styles.label}>
            <span>Role</span>
            <select value={role} onChange={(event) => setRole(event.target.value)} style={styles.input}>
              {roles.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={submitInvite} disabled={!email || submitting} style={styles.button}>
            {submitting ? "Creating invite..." : "Create invite link"}
          </button>
          {inviteLink ? (
            <label style={styles.label}>
              <span>Invite link</span>
              <input readOnly value={inviteLink} style={styles.input} onFocus={(event) => event.currentTarget.select()} />
            </label>
          ) : null}
          {status ? <p style={styles.status}>{status}</p> : null}
        </section>

        <section style={styles.list}>
          <h2 style={styles.sectionTitle}>Recent invitations</h2>
          {invitations.length === 0 ? (
            <p style={styles.empty}>No invitations yet.</p>
          ) : (
            invitations.map((invitation) => (
              <article key={invitation.id} style={styles.invitationRow}>
                <strong>{invitation.invitedEmail}</strong>
                <span>{invitation.role.replace("_", " ")} / {invitation.status.toLowerCase()}</span>
                <span>Expires {new Date(invitation.expiresAt).toLocaleString()}</span>
              </article>
            ))
          )}
        </section>
      </section>
    </AppShell>
  );
}

const styles = {
  shell: {
    display: "grid",
    gap: "18px",
  },
  header: {
    display: "grid",
    gap: "8px",
  },
  eyebrow: {
    ...wmStyles.eyebrow,
    margin: 0,
  },
  title: {
    margin: 0,
    color: wm.colors.text,
    fontSize: "32px",
    lineHeight: 1.2,
  },
  subtitle: {
    margin: 0,
    color: wm.colors.textSecondary,
    fontSize: "15px",
    lineHeight: 1.5,
  },
  panel: {
    ...wmStyles.elevatedCard,
    display: "grid",
    gap: "13px",
    padding: "18px",
    maxWidth: "620px",
  },
  label: {
    display: "grid",
    gap: "6px",
    color: wm.colors.textSecondary,
    fontSize: "13px",
    fontWeight: 800,
  },
  input: {
    ...wmStyles.input,
    height: "42px",
    padding: "0 10px",
  },
  button: {
    ...wmStyles.primaryButton,
    padding: "12px 14px",
    fontWeight: 900,
    cursor: "pointer",
  },
  status: {
    margin: 0,
    color: wm.colors.textSecondary,
    fontSize: "13px",
    lineHeight: 1.4,
    fontWeight: 800,
  },
  list: {
    display: "grid",
    gap: "10px",
    maxWidth: "760px",
  },
  sectionTitle: {
    margin: 0,
    color: wm.colors.text,
    fontSize: "18px",
  },
  empty: {
    margin: 0,
    color: wm.colors.textMuted,
    fontSize: "13px",
  },
  invitationRow: {
    display: "grid",
    gap: "4px",
    border: `1px solid ${wm.colors.border}`,
    borderRadius: wm.radius.lg,
    background: wm.colors.surface,
    padding: "12px",
    color: wm.colors.textSecondary,
    fontSize: "13px",
  },
};
