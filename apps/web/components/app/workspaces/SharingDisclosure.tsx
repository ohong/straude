export function SharingDisclosure() {
  return (
    <section aria-labelledby="sharing-heading" className="rounded border border-border bg-subtle p-5">
      <h2 id="sharing-heading" className="text-lg font-semibold">What you choose to share</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted">
        <li>Members can see the workspace’s combined daily and weekly tokens, tools, models, and estimated value at API prices, plus the member roster and source sync status. These figures do not measure employee productivity or actual billed charges.</li>
        <li>The owner can invite and remove members. A public profile is not required. Joining alone does not collect or share usage.</li>
        <li>Connect only a work-only device or operating-system account. Daily aggregates cannot separate work and personal accounts on a mixed device. All collected Claude Code and Codex usage from that source is shared.</li>
        <li>Collection covers locally available logs the collector can price. Unpriced external models may be omitted; receiving data does not guarantee complete activity.</li>
        <li>Sharing begins the next UTC day after connecting. Earlier usage, including the connection day, stays out of the workspace even on retries or backfills.</li>
        <li>Workspace contributions stay off public feeds, profiles, recaps, and leaderboards. Prompts and code are not uploaded.</li>
        <li>Removing a member stops their access and future contributions. Previously contributed totals remain in the workspace report.</li>
      </ul>
    </section>
  );
}
