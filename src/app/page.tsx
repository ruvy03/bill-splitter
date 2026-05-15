import Link from "next/link";
import { Plus, Users, Receipt } from "lucide-react";
import { listBills } from "@/lib/actions";
import { fmt, computeTotals } from "@/lib/calculations";

export const dynamic = "force-dynamic";

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function HomePage() {
  const bills = await listBills();

  return (
    <div>
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Your bills</h1>
          <p className="text-[color:var(--color-foreground-dim)] mt-1">
            {bills.length === 0
              ? "No bills yet. Start by creating one."
              : `${bills.length} bill${bills.length === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      {bills.length === 0 ? (
        <div className="card p-12 flex flex-col items-center text-center">
          <div className="size-14 rounded-2xl bg-[color:var(--color-accent)]/15 text-[color:var(--color-accent)] flex items-center justify-center mb-4">
            <Receipt size={26} />
          </div>
          <h2 className="text-lg font-medium">Nothing here yet</h2>
          <p className="text-[color:var(--color-foreground-dim)] mt-1 max-w-sm">
            Create your first bill to start splitting expenses between friends,
            roommates, or coworkers.
          </p>
          <Link href="/new" className="btn btn-primary mt-6">
            <Plus size={16} />
            Create a bill
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bills.map((b) => {
            const totals = computeTotals({
              people: b.people,
              items: b.items.map((it) => ({
                id: it.id,
                name: it.name,
                price: it.price,
                shares: it.shares.map((s) => ({
                  personId: s.personId,
                  amount: s.amount,
                })),
              })),
              adjustments: b.adjustments,
            });

            return (
              <Link
                key={b.id}
                href={`/bills/${b.id}`}
                className="card p-5 flex flex-col gap-3 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-medium truncate">{b.title}</h3>
                    <p className="text-xs text-[color:var(--color-muted)] mt-0.5">
                      {formatDate(b.date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-semibold">
                      {fmt(totals.grandTotal)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-[color:var(--color-foreground-dim)]">
                  <span className="inline-flex items-center gap-1.5">
                    <Users size={12} />
                    {b.people.length} people
                  </span>
                  <span>
                    {b.items.length} item{b.items.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {b.people.slice(0, 5).map((p) => (
                    <span
                      key={p.id}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-[color:var(--color-border)]/60 text-[color:var(--color-foreground-dim)]"
                    >
                      {p.name}
                    </span>
                  ))}
                  {b.people.length > 5 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[color:var(--color-border)]/60 text-[color:var(--color-foreground-dim)]">
                      +{b.people.length - 5}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
