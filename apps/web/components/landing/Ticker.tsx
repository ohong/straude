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
          className="inline-block px-8 font-[family-name:var(--font-mono)] text-sm uppercase text-[#888]"
        >
          {item.label}{" "}
          <span className="text-[#F0F0F0] ml-2">{item.value}</span>
        </span>
      ))}
    </>
  );
}

export function Ticker({ items }: { items: TickerItem[] }) {
  return (
    <div className="w-full overflow-hidden border-t border-b border-[#222] py-3 relative z-10 bg-[#050505]">
      <div className="inline-block whitespace-nowrap animate-[ticker_30s_linear_infinite]">
        <TickerStrip items={items} />
        <TickerStrip items={items} />
      </div>
    </div>
  );
}
