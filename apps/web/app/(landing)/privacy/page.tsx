import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Straude",
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar variant="light" />
      <main className="bg-white py-32 md:py-40">
        <article className="mx-auto max-w-2xl px-6 md:px-8">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-muted">
            Last updated: February 18, 2026
          </p>

          <div className="mt-10 space-y-8 text-[0.9375rem] leading-relaxed text-foreground/80">
            <section>
              <h2 className="text-lg font-bold text-foreground">
                1. Information We Collect
              </h2>
              <p className="mt-2">When you use Straude, we collect:</p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li>
                  <strong>Account information:</strong> email address, username,
                  and profile details provided during signup
                </li>
                <li>
                  <strong>Usage data:</strong> Claude Code session statistics
                  you submit (cost, token counts, models used)
                </li>
                <li>
                  <strong>Analytics:</strong> page views and basic interaction
                  data via Vercel Analytics
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground">
                2. How We Use Your Information
              </h2>
              <p className="mt-2">We use your information to:</p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li>Provide and maintain the Service</li>
                <li>Display your activity on feeds and leaderboards</li>
                <li>Send notifications about interactions with your content</li>
                <li>Improve the Service based on usage patterns</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground">
                3. Data Visibility
              </h2>
              <p className="mt-2">
                Your profile and posts are public by default. You can set your
                profile to private in Settings, which hides your posts from the
                feed and removes you from leaderboards. Followers can still see
                your activity.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground">
                4. Data Storage
              </h2>
              <p className="mt-2">
                Your data is stored securely on Supabase infrastructure. We use
                Row Level Security policies to ensure users can only access data
                they are authorized to see.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground">
                5. Third-Party Services
              </h2>
              <p className="mt-2">We use the following third-party services:</p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li>
                  <strong>Supabase:</strong> authentication and database hosting
                </li>
                <li>
                  <strong>Vercel:</strong> application hosting and analytics
                </li>
                <li>
                  <strong>GitHub:</strong> OAuth authentication (if you sign in
                  with GitHub)
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground">
                6. Data Retention
              </h2>
              <p className="mt-2">
                Your data is retained for as long as your account is active. You
                may request deletion of your account and associated data at any
                time.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground">
                7. Cookies
              </h2>
              <p className="mt-2">
                We use essential cookies for authentication and session
                management. We do not use third-party tracking cookies.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground">
                8. Your Rights
              </h2>
              <p className="mt-2">You have the right to:</p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li>Access the personal data we hold about you</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Export your data</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground">
                9. Changes to This Policy
              </h2>
              <p className="mt-2">
                We may update this policy from time to time. We will notify
                users of significant changes via the Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground">
                10. Contact
              </h2>
              <p className="mt-2">
                Questions about this policy? Reach out via{" "}
                <a
                  href="https://github.com/ohong/straude"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline underline-offset-2 hover:no-underline"
                >
                  GitHub
                </a>
                .
              </p>
            </section>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
