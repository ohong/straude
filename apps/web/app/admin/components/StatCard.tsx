export function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="admin-card px-4 py-5 text-center">
      <p
        className="font-mono text-2xl font-semibold tabular-nums sm:text-3xl"
        style={{ color: "var(--admin-fg)" }}
      >
        {value}
      </p>
      <p
        className="mt-2 flex items-center justify-center gap-1.5 text-xs"
        style={{ color: "var(--admin-fg-secondary)" }}
      >
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: "var(--admin-accent)" }}
        />
        {label}
      </p>
    </div>
  );
}
