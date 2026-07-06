type WorkMapLoaderProps = {
  fullPage?: boolean;
  label?: string;
};

export function WorkMapLoader({ fullPage = false, label = "Loading" }: WorkMapLoaderProps) {
  return (
    <div
      className={fullPage ? "wm-loader wm-loader-full-page" : "wm-loader wm-loader-section"}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="wm-loader-mark" aria-hidden="true"><span>WM</span></div>
      <span className="wm-loader-label">{label}</span>
    </div>
  );
}
