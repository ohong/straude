import Link from "next/link";
import { TOKEN_RICH_COMPANIES } from "@/data/token-rich";

export function PrometheusPreview() {
  const top5 = TOKEN_RICH_COMPANIES.slice(0, 5);

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 border-t border-landing-border">
      {/* Section title block */}
      <div className="lg:col-span-4 border-b border-r-0 lg:border-r border-landing-border p-8 lg:p-16 flex flex-col justify-end bg-landing-bg">
        <h2 className="text-landing-text text-xl font-medium tracking-[-0.03em] leading-tight text-balance mb-2">
          The Prometheus
          <br />
          List
        </h2>
        <p className="font-[family-name:var(--font-mono)] text-sm uppercase tracking-wider text-landing-muted">
          TOKEN_RICH COMPANIES
        </p>
      </div>

      {/* Company list */}
      <div className="lg:col-span-8 border-b border-landing-border flex flex-col">
        {top5.map((company, i) => (
          <div
            key={company.name}
            className="flex items-center justify-between border-b border-landing-border px-8 py-4 font-[family-name:var(--font-mono)] text-sm transition-colors hover:bg-landing-hover"
          >
            <div className="flex gap-4">
              <span className="text-landing-muted w-6">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-landing-text">{company.name}</span>
            </div>
            <div className="flex gap-6">
              <span className="hidden text-landing-muted sm:inline">
                {company.hqCity}
              </span>
              <span className="text-accent">{company.policy}</span>
            </div>
          </div>
        ))}

        <Link
          href="/token-rich"
          className="block px-8 py-6 text-center font-[family-name:var(--font-mono)] text-sm text-landing-muted hover:text-landing-text transition-colors"
        >
          &gt; VIEW_FULL_LIST
        </Link>
      </div>
    </section>
  );
}
