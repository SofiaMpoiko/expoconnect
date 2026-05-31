/** Carbon Zapp brand mark — red icon + white wordmark (matches intro). */
export default function BrandLogo() {
  return (
    <div className="cz-brand flex flex-col items-center gap-3 sm:gap-3.5">
      <div className="cz-brand-logo-icon" role="img" aria-label="Carbon Zapp" />
      <img
        src="/carbon-zapp-text.png"
        alt="Carbon Zapp"
        className="cz-brand-logo-text h-7 w-auto max-w-[min(100%,260px)] sm:h-8 sm:max-w-[300px]"
        width={400}
        height={80}
        decoding="async"
      />
    </div>
  );
}
