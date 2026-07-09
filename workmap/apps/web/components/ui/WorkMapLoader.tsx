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
      <div className="wm-loader-walker" aria-hidden="true">
        <span className="wm-loader-walker-layer wm-loader-walker-body" />
        <span className="wm-loader-walker-layer wm-loader-walker-eyes" />
        <span className="wm-loader-walker-layer wm-loader-walker-outfit" />
        <span className="wm-loader-walker-layer wm-loader-walker-hair" />
      </div>
      <span className="wm-loader-label">{label}</span>
    </div>
  );
}
