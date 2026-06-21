import type { VirtualOfficeReaction } from "@workmap/shared-types";

export const reactionOptions: Array<{ key: VirtualOfficeReaction; emoji: string; label: string }> = [
  { key: "wave", emoji: "👋", label: "Wave" },
  { key: "heart", emoji: "❤️", label: "Heart" },
  { key: "party", emoji: "🎉", label: "Celebrate" },
  { key: "thumbs_up", emoji: "👍", label: "Thumbs up" },
  { key: "laugh", emoji: "🤣", label: "Laugh" },
  { key: "clap", emoji: "👏", label: "Clap" },
  { key: "hundred", emoji: "💯", label: "One hundred" },
  { key: "fire", emoji: "🔥", label: "Fire" },
];

export function reactionEmoji(reaction: VirtualOfficeReaction | null | undefined) {
  return reactionOptions.find((option) => option.key === reaction)?.emoji ?? "✨";
}
