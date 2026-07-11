"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LayeredAvatarPreview } from "../../../components/avatar/LayeredAvatarPreview";
import { WorkMapLoader } from "../../../components/ui/WorkMapLoader";
import {
  avatarLayersByType,
  defaultLayeredAvatarConfig,
  type AvatarLayerAsset,
  type AvatarLayerType,
  type LayeredAvatarConfig,
} from "../../../lib/avatar/avatarLayerAssets";
import { getWorkMapApiAuthOptions, type WorkMapApiAuthResult } from "../../../lib/api/apiAuth";
import { getCurrentUser } from "../../../lib/api/authApi";
import { updateCurrentUserProfile } from "../../../lib/api/usersApi";
import { saveLayeredAvatarConfig } from "../../../lib/avatar/avatarStorage";
import { decodeLayeredAvatarId, encodeLayeredAvatarId } from "../../../lib/avatar/avatarProfile";
import { sanitizeDisplayName } from "../../../lib/auth/displayName";
import { redirectToRootForMissingCognitoSession } from "../../../lib/auth/cognitoRedirect";
import { wm, wmStyles } from "../../../lib/theme/workmapTheme";
import { getNextRouteForUser, updateUserSetupState } from "../../../lib/workflow/workflowState";

const groups: Array<{ type: AvatarLayerType; title: string; optional?: boolean; multi?: boolean }> = [
  { type: "body", title: "Body" },
  { type: "eyes", title: "Eyes" },
  { type: "hairstyle", title: "Hairstyle", optional: true },
  { type: "outfit", title: "Outfit", optional: true },
  { type: "accessory", title: "Accessories", optional: true, multi: true },
];

export default function AvatarOnboardingPage() {
  const router = useRouter();
  const [config, setConfig] = useState<LayeredAvatarConfig>(defaultLayeredAvatarConfig);
  const [displayName, setDisplayName] = useState("");
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [apiAuth, setApiAuth] = useState<Extract<WorkMapApiAuthResult, { available: true }> | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [profileStatus, setProfileStatus] = useState("Enter the name teammates should see in WorkMap.");
  const assetsAvailable = avatarLayersByType.body.length > 0;
  const selectedNames = useMemo(() => getSelectedNames(config), [config]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfileName() {
      const auth = await getWorkMapApiAuthOptions();

      if (cancelled) {
        return;
      }

      if (!auth.available) {
        if (redirectToRootForMissingCognitoSession()) return;
        setAuthResolved(true);
        setProfileStatus("Enter the name teammates should see in WorkMap.");
        return;
      }

      setApiAuth(auth);
      setAuthResolved(true);
      const currentUser = await getCurrentUser(auth.options);

      if (cancelled) {
        return;
      }

      if (currentUser.ok) {
        const backendAvatar = decodeLayeredAvatarId(currentUser.data.avatarId);

        if (backendAvatar) {
          setConfig(backendAvatar);
          saveLayeredAvatarConfig(backendAvatar);
          setDisplayName(currentUser.data.displayName);
          setProfileStatus("This profile is loaded from your WorkMap account.");
        } else {
          const canPrefillExistingProfileName = currentUser.data.role && currentUser.data.role !== "EMPLOYEE";
          setDisplayName(canPrefillExistingProfileName ? currentUser.data.displayName : "");
          setProfileStatus(
            canPrefillExistingProfileName
              ? "Confirm your profile name and choose your WorkMap avatar."
              : "Enter the name teammates should see in WorkMap.",
          );
        }
      }
    }

    void loadProfileName();

    return () => {
      cancelled = true;
    };
  }, []);

  const saveAndEnterOffice = async () => {
    if (!config.bodyId) {
      return;
    }

    const confirmedDisplayName = sanitizeDisplayName(displayName);

    if (!confirmedDisplayName) {
      setDisplayNameError("Display name is required and must be between 2 and 80 characters.");
      return;
    }

    setDisplayNameError(null);

    if (apiAuth) {
      setProfileStatus("Saving your profile...");
      const profileResult = await updateCurrentUserProfile(
        { displayName: confirmedDisplayName, avatarId: encodeLayeredAvatarId(config) },
        apiAuth.options,
      );

      if (!profileResult.ok) {
        setProfileStatus("WorkMap could not save that profile. Please try again.");
        return;
      }

      setProfileStatus("Profile saved.");
    }

    saveLayeredAvatarConfig(config);
    const nextState = updateUserSetupState({ hasAvatar: true });
    router.push(getNextRouteForUser(nextState));
  };

  if (!authResolved) {
    return <WorkMapLoader fullPage label="Checking account access" />;
  }

  return (
    <main className="wm-onboarding-page wm-avatar-onboarding" style={styles.page}>
      <section className="wm-onboarding-shell" style={styles.shell}>
        <div className="wm-onboarding-header" style={styles.header}>
          <p style={styles.eyebrow}>Choose your avatar</p>
          <h1 style={styles.title}>Create your WorkMap avatar</h1>
          <p style={styles.subtitle}>Choose how you appear in the virtual office.</p>
        </div>

        {!assetsAvailable ? (
          <section style={styles.emptyState}>
            <h2 style={styles.sectionTitle}>No avatar layers found</h2>
            <p style={styles.bodyText}>Add body layer assets before users can create an avatar.</p>
          </section>
        ) : (
          <div className="wm-avatar-layout" style={styles.layout}>
            <section className="wm-avatar-builder" style={styles.panel}>
              <h2 style={styles.sectionTitle}>Build your avatar</h2>
              <p style={styles.bodyText}>Pick a body, eyes, hairstyle, outfit, and optional accessory.</p>

              <label style={styles.label}>
                <span>Your display name</span>
                <input
                  value={displayName}
                  onChange={(event) => {
                    setDisplayName(event.target.value);
                    if (displayNameError && sanitizeDisplayName(event.target.value)) {
                      setDisplayNameError(null);
                    }
                  }}
                  placeholder="How teammates should see you"
                  aria-invalid={Boolean(displayNameError)}
                  aria-describedby={displayNameError ? "avatar-display-name-error" : undefined}
                  style={{ ...styles.input, ...(displayNameError ? styles.inputError : {}) }}
                />
                {displayNameError ? <span id="avatar-display-name-error" style={styles.errorText}>{displayNameError}</span> : null}
                <span style={styles.helpText}>{profileStatus}</span>
              </label>

              <div style={styles.groupStack}>
                {groups.map((group) => (
                  <LayerGroup key={group.type} group={group} config={config} onChange={setConfig} />
                ))}
              </div>
            </section>

            <aside className="wm-avatar-preview-panel" style={styles.panel}>
              <div style={styles.previewWrap}>
                <LayeredAvatarPreview config={config} size={176} />
              </div>
              <h2 style={styles.sectionTitle}>Your avatar</h2>
              <p style={styles.bodyText}>{selectedNames}</p>
              <p style={styles.trustNote}>
                WorkMap uses avatars for presence and collaboration. Activity visibility remains transparent and role-based.
              </p>
              <button type="button" onClick={saveAndEnterOffice} disabled={!config.bodyId} style={styles.saveButton}>
                Save and continue
              </button>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}

function LayerGroup({
  group,
  config,
  onChange,
}: {
  group: { type: AvatarLayerType; title: string; optional?: boolean; multi?: boolean };
  config: LayeredAvatarConfig;
  onChange: (config: LayeredAvatarConfig) => void;
}) {
  const assets = avatarLayersByType[group.type];

  return (
    <section className="wm-avatar-layer-group" style={styles.layerGroup}>
      <div style={styles.groupHeader}>
        <h3 style={styles.groupTitle}>{group.title}</h3>
        {group.optional ? (
          <button type="button" onClick={() => onChange(clearLayer(config, group.type))} style={styles.clearButton}>
            None
          </button>
        ) : null}
      </div>
      <div className="wm-avatar-option-grid" style={styles.optionGrid}>
        {assets.map((asset) => {
          const selected = isSelected(config, asset);
          return (
            <button
              key={asset.id}
              type="button"
              onClick={() => onChange(selectLayer(config, asset, Boolean(group.multi)))}
              style={{
                ...styles.optionButton,
                borderColor: selected ? wm.colors.secondary : wm.colors.border,
                background: selected ? wm.colors.infoBg : wm.colors.surface,
              }}
            >
              <LayeredAvatarPreview config={previewConfigFor(asset, config)} size={48} />
              <span style={styles.optionName}>{asset.name}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function selectLayer(config: LayeredAvatarConfig, asset: AvatarLayerAsset, multi: boolean): LayeredAvatarConfig {
  if (asset.type === "accessory") {
    const current = config.accessoryIds ?? [];
    return {
      ...config,
      accessoryIds: multi && current.includes(asset.id) ? current.filter((assetId) => assetId !== asset.id) : [asset.id],
    };
  }

  if (asset.type === "body") {
    return { ...config, bodyId: asset.id };
  }
  if (asset.type === "eyes") {
    return { ...config, eyesId: asset.id };
  }
  if (asset.type === "hairstyle") {
    return { ...config, hairstyleId: asset.id };
  }
  return { ...config, outfitId: asset.id };
}

function clearLayer(config: LayeredAvatarConfig, type: AvatarLayerType): LayeredAvatarConfig {
  if (type === "accessory") {
    return { ...config, accessoryIds: [] };
  }
  if (type === "eyes") {
    return { ...config, eyesId: undefined };
  }
  if (type === "hairstyle") {
    return { ...config, hairstyleId: undefined };
  }
  if (type === "outfit") {
    return { ...config, outfitId: undefined };
  }
  return config;
}

function isSelected(config: LayeredAvatarConfig, asset: AvatarLayerAsset) {
  if (asset.type === "body") {
    return config.bodyId === asset.id;
  }
  if (asset.type === "eyes") {
    return config.eyesId === asset.id;
  }
  if (asset.type === "hairstyle") {
    return config.hairstyleId === asset.id;
  }
  if (asset.type === "outfit") {
    return config.outfitId === asset.id;
  }
  return (config.accessoryIds ?? []).includes(asset.id);
}

function previewConfigFor(asset: AvatarLayerAsset, config: LayeredAvatarConfig): LayeredAvatarConfig {
  return selectLayer({ ...config, accessoryIds: asset.type === "accessory" ? [] : config.accessoryIds }, asset, false);
}

function getSelectedNames(config: LayeredAvatarConfig) {
  const selected = groups
    .flatMap((group) => avatarLayersByType[group.type])
    .filter((asset) => isSelected(config, asset))
    .map((asset) => asset.name);

  return selected.length > 0 ? selected.join(" / ") : "Choose at least a body to continue.";
}

const styles = {
  page: {
    minHeight: "100vh",
    background: wm.colors.appBackground,
    color: wm.colors.text,
    fontFamily: wm.typography.fontFamily,
    padding: "var(--wm-shell-block) var(--wm-shell-inline)",
  },
  shell: {
    maxWidth: "1280px",
    margin: "0 auto",
  },
  header: {
    marginBottom: "22px",
  },
  eyebrow: {
    margin: "0 0 8px",
    color: wm.colors.secondary,
    fontSize: "13px",
    fontWeight: 800,
    textTransform: "uppercase" as const,
  },
  title: {
    margin: 0,
    color: wm.colors.textHeading,
    fontFamily: wm.typography.displayFontFamily,
    fontSize: "34px",
    lineHeight: 1.15,
    fontWeight: 750,
    letterSpacing: 0,
  },
  subtitle: {
    margin: "10px 0 0",
    color: wm.colors.textSecondary,
    fontSize: "17px",
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
    gap: "18px",
    alignItems: "start",
  },
  panel: {
    ...wmStyles.card,
    padding: "20px",
  },
  sectionTitle: {
    margin: "0 0 8px",
    fontSize: "22px",
  },
  bodyText: {
    margin: "0 0 16px",
    color: wm.colors.textSecondary,
    fontSize: "14px",
    lineHeight: 1.55,
  },
  label: {
    display: "grid",
    gap: "6px",
    marginBottom: "18px",
    color: wm.colors.textSecondary,
    fontSize: "13px",
    fontWeight: 900,
  },
  input: {
    height: "42px",
    ...wmStyles.input,
    padding: "0 10px",
    fontSize: "14px",
  },
  inputError: {
    borderColor: wm.colors.error,
    boxShadow: `0 0 0 3px ${wm.colors.errorBg}`,
  },
  errorText: {
    color: wm.colors.errorText,
    fontSize: "12px",
    fontWeight: 800,
    lineHeight: 1.4,
  },
  helpText: {
    color: wm.colors.textMuted,
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: 1.4,
  },
  trustNote: {
    margin: "0 0 16px",
    color: wm.colors.textSecondary,
    fontSize: "13px",
    lineHeight: 1.5,
  },
  groupStack: {
    display: "grid",
    gap: "18px",
  },
  layerGroup: {
    display: "grid",
    gap: "10px",
  },
  groupHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  groupTitle: {
    margin: 0,
    fontSize: "16px",
  },
  optionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))",
    gap: "10px",
    maxHeight: "260px",
    overflow: "auto",
    paddingRight: "4px",
  },
  optionButton: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    border: `1px solid ${wm.colors.border}`,
    borderRadius: wm.radius.lg,
    background: wm.colors.surface,
    padding: "8px",
    color: wm.colors.text,
    cursor: "pointer",
    textAlign: "left" as const,
  },
  optionName: {
    fontWeight: 800,
    fontSize: "13px",
    lineHeight: 1.2,
  },
  previewWrap: {
    display: "grid",
    placeItems: "center",
    minHeight: "220px",
    marginBottom: "14px",
    borderRadius: wm.radius.xl,
    background: wm.colors.surfaceLow,
    border: `1px solid ${wm.colors.borderSubtle}`,
  },
  saveButton: {
    width: "100%",
    ...wmStyles.primaryButton,
    padding: "11px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  clearButton: {
    ...wmStyles.secondaryButton,
    padding: "5px 8px",
    cursor: "pointer",
    fontWeight: 700,
  },
  emptyState: {
    ...wmStyles.card,
    padding: "24px",
  },
};
