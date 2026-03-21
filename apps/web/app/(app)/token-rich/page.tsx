import { TOKEN_RICH_COMPANIES, mapDbRow } from "@/data/token-rich";
import type { TokenRichCompany } from "@/data/token-rich";
import { PrometheusTable } from "@/components/app/token-rich/PrometheusTable";
import { SuggestCompanyWidget } from "@/components/app/token-rich/SuggestCompanyWidget";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth";
import type { Metadata } from "next";

export const revalidate = 300; // revalidate every 5 minutes

const DESCRIPTION =
  "Companies fueling unlimited AI spend for their engineers. Verified policies, public sources.";

const OG_IMAGE = {
  url: "/images/prometheus-hero.png",
  width: 1584,
  height: 672,
  alt: "The Prometheus List — Companies fueling unlimited AI spend for their engineers.",
  type: "image/png",
};

export const metadata: Metadata = {
  title: "The Prometheus List",
  description: DESCRIPTION,
  alternates: {
    canonical: "/token-rich",
  },
  openGraph: {
    type: "website",
    url: "/token-rich",
    title: "The Prometheus List | Straude",
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Prometheus List | Straude",
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

async function getCompanies(): Promise<TokenRichCompany[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("token_rich_companies")
      .select("name, company_url, hq_city, stage, policy, source_text, source_link_label, source_link_url")
      .eq("is_published", true)
      .order("display_order", { ascending: true });

    if (error || !data || data.length === 0) {
      return TOKEN_RICH_COMPANIES;
    }

    return data.map(mapDbRow);
  } catch {
    return TOKEN_RICH_COMPANIES;
  }
}

export default async function TokenRichPage() {
  const [user, companies] = await Promise.all([
    getAuthUser(),
    getCompanies(),
  ]);

  return (
    <SuggestCompanyWidget isLoggedIn={!!user}>
      <PrometheusTable companies={companies} isLoggedIn={!!user} />
    </SuggestCompanyWidget>
  );
}
