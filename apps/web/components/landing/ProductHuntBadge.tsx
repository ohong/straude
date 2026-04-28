const PRODUCT_HUNT_URL =
  "https://www.producthunt.com/products/straude/launches/straude?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-straude";
const BADGE_SRC =
  "https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1114059&theme=dark&t=1777407227004";

const WIDTH = 188;
const HEIGHT = 41;

export function ProductHuntBadge() {
  return (
    <a
      href={PRODUCT_HUNT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block transition-transform active:scale-[0.98]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BADGE_SRC}
        alt="Straude - Strava for Claude Code, the global tokenmaxxing Leaderboard | Product Hunt"
        width={WIDTH}
        height={HEIGHT}
        style={{ width: WIDTH, height: HEIGHT }}
      />
    </a>
  );
}
