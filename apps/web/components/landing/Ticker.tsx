interface TickerItem {
  label: string;
  value: string;
}

function TickerStrip({ items }: { items: TickerItem[] }) {
  return (
    <>
      {items.map((item) => (
        <span
          key={item.label}
          className="inline-block px-8 font-[family-name:var(--font-mono)] text-sm uppercase text-landing-muted"
        >
          {item.label}{" "}
          <span className="text-landing-text ml-2">{item.value}</span>
        </span>
      ))}
    </>
  );
}

export function Ticker({ items }: { items: TickerItem[] }) {
  return (
    <div className="w-full overflow-hidden border-t border-b border-landing-border py-3 relative z-10 bg-landing-bg">
      <div className="inline-block whitespace-nowrap animate-ticker">
        <TickerStrip items={items} />
        <TickerStrip items={items} />
      </div>
    </div>
  );
}
