export interface TokenRichCompany {
  name: string;
  companyUrl?: string;
  hqCity: string;
  stage: "Big Tech" | "Startup";
  policy: "Unlimited" | "Very High";
  source: {
    text: string;
    link?: { label: string; url: string };
  };
}

/**
 * Maps a Supabase row from `token_rich_companies` to the client-side interface.
 */
export function mapDbRow(row: {
  name: string;
  company_url: string | null;
  hq_city: string;
  stage: string;
  policy: string;
  source_text: string;
  source_link_label: string | null;
  source_link_url: string | null;
}): TokenRichCompany {
  return {
    name: row.name,
    companyUrl: row.company_url ?? undefined,
    hqCity: row.hq_city,
    stage: row.stage as "Big Tech" | "Startup",
    policy: row.policy as "Unlimited" | "Very High",
    source: {
      text: row.source_text,
      link:
        row.source_link_label && row.source_link_url
          ? { label: row.source_link_label, url: row.source_link_url }
          : undefined,
    },
  };
}

/**
 * Static fallback used when Supabase is unavailable (build time, etc.).
 * Kept in sync with the `token_rich_companies` table.
 */
export const TOKEN_RICH_COMPANIES: TokenRichCompany[] = [
  { name: "NVIDIA", companyUrl: "https://www.nvidia.com/", hqCity: "Santa Clara, CA", stage: "Big Tech", policy: "Very High", source: { text: 'CEO Jensen Huang: "If our $500,000 engineer did not consume at least $250,000 worth of tokens, I am going to be deeply alarmed."', link: { label: "Business Insider", url: "https://www.businessinsider.com/jensen-huang-500k-engineers-250k-ai-tokens-nvidia-compute-2026-3" } } },
  { name: "Resend", companyUrl: "https://resend.com", hqCity: "San Francisco, CA", stage: "Startup", policy: "Unlimited", source: { text: '"Every employee at Resend gets access to multiple AI tools. No credit caps, no approval process. Use as much as you want."', link: { label: "X @resend", url: "https://x.com/resend/status/2027791164901101904" } } },
  { name: "Notion", companyUrl: "https://www.notion.so", hqCity: "San Francisco, CA", stage: "Startup", policy: "Unlimited", source: { text: 'CEO Ivan Zhao: "We encourage our engineers to burn as many tokens as possible."', link: { label: "LinkedIn (via Reid Hoffman)", url: "https://www.linkedin.com/posts/reidhoffman_notions-founder-ivan-zhao-says-you-shouldn-activity-7435367349748215808-68IS/" } } },
  { name: "Ramp", companyUrl: "https://ramp.com", hqCity: "New York, NY", stage: "Startup", policy: "Unlimited", source: { text: '"Unlimited AI token usage"', link: { label: "Ramp Careers", url: "https://ramp.com/careers" } } },
  { name: "AirOps", companyUrl: "https://www.airops.com", hqCity: "Miami, FL", stage: "Startup", policy: "Unlimited", source: { text: '"No counting tokens, no rationing, and definitely no asking for permission."', link: { label: "LinkedIn Matt Hammel", url: "https://www.linkedin.com/posts/matt-hammel-84a38054_a-new-engineer-asked-me-in-a-11-yesterday-activity-7430281614242258944-Mgb_/" } } },
  { name: "Basis AI", companyUrl: "https://www.getbasis.ai", hqCity: "New York, NY", stage: "Startup", policy: "Unlimited", source: { text: '"We give every engineer an unlimited token budget"', link: { label: "Basis AI Careers", url: "https://www.getbasis.ai/careers/job?id=d0c983cf-214a-4d03-9ef4-e680ddf5022b" } } },
  { name: "Valon", companyUrl: "https://www.valon.com", hqCity: "New York, NY", stage: "Startup", policy: "Unlimited", source: { text: '"Valon gives our team unlimited token budget. Tinkering and experimenting are encouraged."', link: { label: "LinkedIn (via CoS Ariel Brito)", url: "https://www.linkedin.com/posts/arielbritomit_one-thing-i-didnt-expect-to-matter-as-much-activity-7429947855404167168-Hp_Y/" } } },
  { name: "Eigen Labs", companyUrl: "https://www.eigenlayer.xyz", hqCity: "Seattle, WA", stage: "Startup", policy: "Unlimited", source: { text: '"Everyone at EIGEN has unlimited Claude Code access."', link: { label: "X @0xkydo", url: "https://x.com/0xkydo/status/2027708609879281712" } } },
  { name: "Polygon", companyUrl: "https://polygon.technology", hqCity: "Dubai, UAE", stage: "Big Tech", policy: "Very High", source: { text: '"Every employee will get $200 a year to spend on any AI tools they want."', link: { label: "X @sandeepnailwal", url: "https://x.com/sandeepnailwal/status/2026438133408215323" } } },
  { name: "LazyCat", companyUrl: "https://lazycat.cloud", hqCity: "Beijing, China", stage: "Startup", policy: "Unlimited", source: { text: '"没有限额，无限Tokens，让你用到爽。"', link: { label: "X @manateelazycat", url: "https://x.com/manateelazycat/status/2034177536989823279" } } },
  { name: "primitive", companyUrl: "https://primitive.tech", hqCity: "San Francisco, CA", stage: "Startup", policy: "Unlimited", source: { text: '"You should have at least 2 agents running right now. We have an unlimited AI budget for all team members"', link: { label: "YC Jobs", url: "https://www.ycombinator.com/companies/primitive/jobs/BN1qxqc-founding-engineer" } } },
  { name: "Browserbase", companyUrl: "https://www.browserbase.com", hqCity: "San Francisco, CA", stage: "Startup", policy: "Unlimited", source: { text: '"Every engineer gets any API key they want with no limits."', link: { label: "X @pk_iv", url: "https://x.com/pk_iv/status/2009721729560789086" } } },
  { name: "Webflow", companyUrl: "https://webflow.com", hqCity: "San Francisco, CA", stage: "Startup", policy: "Unlimited", source: { text: '"At @webflow everyone gets unlimited tokens."', link: { label: "X @leinwand", url: "https://x.com/leinwand/status/2033934967089336505" } } },
  { name: "Shopify", companyUrl: "https://www.shopify.com", hqCity: "Ottawa, Canada", stage: "Big Tech", policy: "Very High", source: { text: '"Reflexive AI usage is a baseline expectation at Shopify."', link: { label: "First Round Review", url: "https://www.firstround.com/ai/shopify" } } },
  { name: "n8n", companyUrl: "https://n8n.io", hqCity: "Berlin, Germany", stage: "Startup", policy: "Unlimited", source: { text: '"Everyone gets an unlimited AI budget."', link: { label: "n8n Careers", url: "https://n8n.io/careers/" } } },
  { name: "Zip", companyUrl: "https://ziphq.com", hqCity: "San Francisco, CA", stage: "Startup", policy: "Unlimited", source: { text: '"Unlimited AI token usage"', link: { label: "Zip Careers", url: "https://ziphq.com/careers" } } },
  { name: "Vercel", companyUrl: "https://vercel.com", hqCity: "San Francisco, CA", stage: "Startup", policy: "Unlimited", source: { text: "CEO Guillermo Rauch: highest token spenders = top performers; \"$10,000 spend for a day's work probably saved him millions.\"", link: { label: "WSJ", url: "https://www.wsj.com/tech/ai/ai-tokens-productivity-d35c6bd8" } } },
  { name: "Anthropic", companyUrl: "https://www.anthropic.com", hqCity: "San Francisco, CA", stage: "Startup", policy: "Unlimited", source: { text: 'Head of Claude Code Boris Cherny: "Give engineers unlimited tokens... Some engineers at Anthropic spend hundreds of thousands of dollars a month on tokens."', link: { label: "Lenny's Podcast", url: "https://www.youtube.com/watch?v=We7BZVKbCVw" } } },
  { name: "OpenAI", companyUrl: "https://openai.com", hqCity: "San Francisco, CA", stage: "Startup", policy: "Unlimited", source: { text: "Employees compete on internal leaderboards for max token use", link: { label: "NYT", url: "https://www.nytimes.com/2026/03/20/technology/tokenmaxxing-ai-agents.html" } } },
  { name: "Meta", companyUrl: "https://about.meta.com", hqCity: "Menlo Park, CA", stage: "Big Tech", policy: "Very High", source: { text: 'Unlimited Claude Code access; "We literally have a leaderboard of who has cost the most in compute\u2026 there are folks north of $80k in spend."', link: { label: "Reddit", url: "https://www.reddit.com/r/ClaudeAI/comments/1rnugkx/meta_w_unlimited_claude_tokens_and_youre/" } } },
  { name: "Rootly", companyUrl: "https://rootly.com", hqCity: "San Francisco, CA", stage: "Startup", policy: "Unlimited", source: { text: 'CEO JJ Tang: "Unlimited tokens from day one... No budgets, no throttling"', link: { label: "LinkedIn", url: "https://www.linkedin.com/posts/jjrichardtang_the-engineers-ive-always-dreamed-of-hiring-activity-7440752293748064257-uhIs" } } },
  { name: "Railway", companyUrl: "https://railway.app", hqCity: "San Francisco, CA", stage: "Startup", policy: "Unlimited", source: { text: '"Railway Employee Perk: Unlimited Claude/Anthropic tokens"', link: { label: "X @JustJake", url: "https://x.com/JustJake/status/2017031311735869931" } } },
  { name: "Cosine AI", companyUrl: "https://cosine.sh", hqCity: "London, UK", stage: "Startup", policy: "Unlimited", source: { text: '"Cosine employee perk: Unlimited tokens, we even have a leader board"', link: { label: "X @PandelisZ", url: "https://x.com/PandelisZ/status/2017306868511637728" } } },
  { name: "DoiT", companyUrl: "https://www.doit.com", hqCity: "Santa Clara, CA", stage: "Startup", policy: "Unlimited", source: { text: '"Every engineer gets unlimited Cursor, Claude Code, and Codex licenses"', link: { label: "DoiT Careers", url: "https://careers.doit.com/teams/engineering" } } },
  { name: "Typeform", companyUrl: "https://www.typeform.com", hqCity: "Barcelona, Spain", stage: "Startup", policy: "Very High", source: { text: "", link: { label: "How to Scale AI Without Breaking the Bank: Typeform's Strategy", url: "https://www.youtube.com/watch?v=mFAiz76YBuM" } } },
  { name: "Writer", companyUrl: "https://writer.com", hqCity: "San Francisco, CA", stage: "Startup", policy: "Very High", source: { text: 'CEO May Habib: "At WRITER, we celebrate when non-engineering employees hit the 1B token / month club."', link: { label: "LinkedIn", url: "https://www.linkedin.com/posts/may-habib_every-leader-should-be-trying-to-get-their-activity-7436786723818217472-jDJ3/" } } },
  { name: "Arcade.dev", companyUrl: "https://arcade.dev", hqCity: "San Francisco, CA", stage: "Startup", policy: "Very High", source: { text: "CEO Alex Salazar: \"I'm like, 'Guys, you're not going hard enough,'\"", link: { label: "Bloomberg", url: "https://archive.ph/12ueV" } } },
  { name: "Hamming.ai", companyUrl: "https://hamming.ai", hqCity: "San Francisco, CA", stage: "Startup", policy: "Unlimited", source: { text: '"Every frontier tool, fully paid."', link: { label: "Hamming Careers", url: "https://hamming.ai/careers" } } },
  { name: "Genspark", companyUrl: "https://www.genspark.ai", hqCity: "Palo Alto, CA", stage: "Startup", policy: "Unlimited", source: { text: "CEO Eric Jing: We have a culture that says \"if you didn't use AI for this, tell us why.\"", link: { label: "X", url: "https://x.com/ericjing_ai/status/2034936140734898434" } } },
  { name: "Tellen", companyUrl: "https://www.tellen.ai", hqCity: "New York, NY", stage: "Startup", policy: "Unlimited", source: { text: '"Unlimited access to the best agentic coding tools"', link: { label: "Tellen Careers", url: "https://www.tellen.ai/careers" } } },
  { name: "Shakepay", companyUrl: "https://shakepay.com", hqCity: "Montreal, Canada", stage: "Startup", policy: "Unlimited", source: { text: '"Generous AI token budget (currently unlimited)"', link: { label: "Shakepay Careers", url: "https://shakepay.com/careers#openings" } } },
  { name: "Fetch Pet", companyUrl: "https://www.fetchpet.com.au", hqCity: "Sydney, Australia", stage: "Startup", policy: "Unlimited", source: { text: '"Unlimited AI tooling - no token limits or approvals needed. Just experiment and learn"', link: { label: "Fetch Pet Careers", url: "https://www.fetchpet.com.au/about" } } },
  { name: "EliseAI", companyUrl: "https://www.eliseai.com", hqCity: "New York, NY", stage: "Startup", policy: "Unlimited", source: { text: '"Unlimited tokens."', link: { label: "EliseAI Careers", url: "https://eliseai.com/careers" } } },
  { name: "Delvo", companyUrl: "https://delvo.ai", hqCity: "Berlin, Germany", stage: "Startup", policy: "Unlimited", source: { text: '"AI-first tooling \u2014 unlimited tokens"', link: { label: "Careers at Delvo", url: "https://www.delvo.ai/careers" } } },
  { name: "Superconductor", companyUrl: "https://www.superconductor.com", hqCity: "El Cerrito, CA", stage: "Startup", policy: "Very High", source: { text: '"a practically unlimited token budget!"', link: { label: "Superconductor Careers", url: "https://www.superconductor.com/careers" } } },
  { name: "Hercules AI", companyUrl: "https://hercules.ai", hqCity: "Campbell, CA", stage: "Startup", policy: "Unlimited", source: { text: "\"Use whatever AI tools you'd like (you have an unlimited AI budget).\"", link: { label: "Hercules Careers", url: "https://hercules.app/careers" } } },
  { name: "Abnormal Security", companyUrl: "https://abnormalsecurity.com", hqCity: "San Francisco, CA", stage: "Startup", policy: "Unlimited", source: { text: '"Every AI Tool is approved."', link: { label: "Abnormal AI Product Builders Program", url: "https://builders.abnormal.ai/" } } },
  { name: "Mashgin", companyUrl: "https://www.mashgin.com", hqCity: "Palo Alto, CA", stage: "Startup", policy: "Unlimited", source: { text: '"You get an unlimited token budget as long as you keep shipping great work."', link: { label: "Mashgin Careers", url: "https://www.mashgin.com/careers" } } },
  { name: "HUD", companyUrl: "https://www.hud.so", hqCity: "San Francisco, CA", stage: "Startup", policy: "Unlimited", source: { text: '"You will have unlimited access to API credits"', link: { label: "YC Jobs", url: "https://www.ycombinator.com/companies/hud/jobs/1w9dsCk-design-engineer" } } },
  { name: "Extend", companyUrl: "https://www.extend.app", hqCity: "New York, NY", stage: "Startup", policy: "Unlimited", source: { text: '"Unlimited token / tooling access - no handicaps on your productivity."', link: { label: "Extend Careers", url: "https://www.extend.ai/about#careers" } } },
  { name: "Dataleap", companyUrl: "https://www.dataleap.ai", hqCity: "San Francisco, CA", stage: "Startup", policy: "Unlimited", source: { text: '"Unlimited AI budget to automate your work"', link: { label: "YC Jobs", url: "https://www.ycombinator.com/companies/dataleap/jobs/GyWW2mr-chief-of-staff-founding-growth-ops" } } },
  { name: "Nansen.ai", companyUrl: "https://www.nansen.ai", hqCity: "Singapore", stage: "Startup", policy: "Unlimited", source: { text: '"Unlimited AI tokens: Claude, OpenAI, whatever helps you move fast."', link: { label: "Nansen Careers", url: "https://www.nansen.ai/careers" } } },
  { name: "Scout AI", companyUrl: "https://www.scouta.ai", hqCity: "Sunnyvale, CA", stage: "Startup", policy: "Unlimited", source: { text: '"Unlimited AI tokens"', link: { label: "Scout AI Careers", url: "https://scoutco.ai/company" } } },
];
