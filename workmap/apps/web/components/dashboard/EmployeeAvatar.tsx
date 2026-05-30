import { LayeredAvatarPreview } from "../avatar/LayeredAvatarPreview";
import type { LayeredAvatarConfig } from "../../lib/avatar/avatarLayerAssets";

type EmployeeAvatarProps = {
  avatar: LayeredAvatarConfig;
  size?: number;
};

export function EmployeeAvatar({ avatar, size = 56 }: EmployeeAvatarProps) {
  return <LayeredAvatarPreview config={avatar} size={size} />;
}
