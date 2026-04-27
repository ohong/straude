const PRODUCT_HUNT_URL = "https://www.producthunt.com/products/straude";
const RANK = 6;

export function ProductHuntBadge() {
  return (
    <a
      href={PRODUCT_HUNT_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Straude — #${RANK} Product of the Day on Product Hunt`}
      className="group inline-flex items-center gap-3 border border-landing-border bg-landing-panel px-4 py-3 transition-[border-color,transform] hover:border-accent active:scale-[0.98]"
    >
      <Medal rank={RANK} />
      <span className="flex flex-col leading-tight">
        <span className="font-[family-name:var(--font-mono)] text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-landing-muted">
          Product Hunt
        </span>
        <span className="text-base font-semibold tracking-tight text-accent">
          #{RANK} Product of the Day
        </span>
      </span>
    </a>
  );
}

function Medal({ rank }: { rank: number }) {
  return (
    <svg
      width="36"
      height="44"
      viewBox="0 0 36 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M10 22 L6 40 L13 36 L16 42 L20 28 Z"
        fill="#DF561F"
        opacity="0.85"
      />
      <path
        d="M26 22 L30 40 L23 36 L20 42 L16 28 Z"
        fill="#B8431A"
        opacity="0.85"
      />
      <circle cx="18" cy="18" r="14" fill="#DF561F" />
      <circle cx="18" cy="18" r="14" stroke="#8C3414" strokeWidth="1" />
      <circle cx="18" cy="18" r="10" fill="none" stroke="#8C3414" strokeWidth="0.75" opacity="0.6" />
      <text
        x="18"
        y="23"
        textAnchor="middle"
        fontFamily="var(--font-mono), ui-monospace, monospace"
        fontSize="13"
        fontWeight="700"
        fill="#fff"
      >
        {rank}
      </text>
    </svg>
  );
}
