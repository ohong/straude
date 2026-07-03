const PRODUCT_HUNT_URL =
  "https://www.producthunt.com/products/straude/launches/straude?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-straude";

export function ProductHuntBadge() {
  return (
    <a
      href={PRODUCT_HUNT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 border border-landing-border bg-landing-panel px-3 py-2 font-[family-name:var(--font-mono)] text-xs uppercase tracking-wider text-landing-muted transition-[border-color,color,transform] hover:border-accent/50 hover:text-landing-text active:scale-[0.98]"
    >
      <span className="text-accent">Featured</span>
      <span>on Product Hunt</span>
    </a>
  );
}
