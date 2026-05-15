import { fmt } from "@/lib/calculations";

/**
 * Single person's card for the detail view.
 * Matches the style in the reference image:
 *   [Name]
 *   [$Total]
 *   ---
 *   [item 1]        [$]
 *   [item 2]        [$]
 *   [Tax + fees]    [$]
 */
export function SplitCard({
  name,
  total,
  lines,
}: {
  name: string;
  total: number;
  lines: { label: string; amount: number }[];
}) {
  return (
    <div className="card p-5 flex flex-col">
      <div className="text-sm text-[color:var(--color-foreground-dim)] mb-0.5">
        {name}
      </div>
      <div className="text-3xl font-semibold tracking-tight tabular-nums">
        {fmt(total)}
      </div>

      {lines.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[color:var(--color-border)] space-y-1">
          {lines.map((line, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-sm"
            >
              <span
                className={
                  line.amount < 0
                    ? "text-rose-400/90"
                    : "text-[color:var(--color-foreground-dim)]"
                }
              >
                {line.label}
              </span>
              <span
                className={`tabular-nums font-medium ${
                  line.amount < 0 ? "text-rose-400/90" : ""
                }`}
              >
                {line.amount < 0
                  ? `−${fmt(Math.abs(line.amount))}`
                  : fmt(line.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
