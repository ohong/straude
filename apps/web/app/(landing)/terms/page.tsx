import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Straude",
};

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="bg-white py-32 md:py-40">
        <article className="mx-auto max-w-2xl px-6 md:px-8">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-muted">
            Last updated: February 18, 2026
          </p>

          <div className="mt-10 space-y-8 text-[0.9375rem] leading-relaxed text-foreground/80">
            <section>
              <h2 className="text-lg font-bold text-foreground">
                1. Acceptance of Terms
              </h2>
              <p className="mt-2">
                By accessing or using Straude ("the Service"), you agree to be
                bound by these Terms of Service. If you do not agree, do not use
                the Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground">
                2. Description of Service
              </h2>
              <p className="mt-2">
                Straude is a platform for tracking and sharing Claude Code usage
                statistics. The Service allows you to log sessions, view
                leaderboards, and interact with other users.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground">
                3. User Accounts
              </h2>
              <p className="mt-2">
                You are responsible for maintaining the security of your account
                credentials. You must not share your account or use another
                person's account without permission.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground">
                4. Acceptable Use
              </h2>
              <p className="mt-2">You agree not to:</p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li>Submit false or misleading usage data</li>
                <li>Attempt to manipulate leaderboards or rankings</li>
                <li>Harass, abuse, or harm other users</li>
                <li>
                  Use the Service for any unlawful purpose or in violation of
                  any applicable laws
                </li>
                <li>
                  Interfere with or disrupt the Service or its infrastructure
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground">
                5. User Content
              </h2>
              <p className="mt-2">
                You retain ownership of any content you submit. By posting
                content, you grant Straude a non-exclusive, worldwide license to
                display it within the Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground">
                6. Termination
              </h2>
              <p className="mt-2">
                We may suspend or terminate your access at any time for
                violation of these terms. You may delete your account at any
                time through your account settings.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground">
                7. Disclaimer of Warranties
              </h2>
              <p className="mt-2">
                The Service is provided "as is" without warranties of any kind,
                express or implied. We do not guarantee that the Service will be
                uninterrupted, secure, or error-free.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground">
                8. Limitation of Liability
              </h2>
              <p className="mt-2">
                To the maximum extent permitted by law, Straude shall not be
                liable for any indirect, incidental, special, or consequential
                damages arising from your use of the Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground">
                9. Changes to Terms
              </h2>
              <p className="mt-2">
                We may update these terms from time to time. Continued use of
                the Service after changes constitutes acceptance of the updated
                terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground">10. Contact</h2>
              <p className="mt-2">
                Questions about these terms? Reach out via{" "}
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
