import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, Pencil } from "lucide-react";
import { getBill } from "@/lib/actions";
import { computeTotals, fmt, lineItemsForPerson } from "@/lib/calculations";
import { SplitCard } from "@/components/SplitCard";
import { SpendingPieChart } from "@/components/Charts";
import { DeleteBillButton } from "@/components/DeleteBillButton";

export const dynamic = "force-dynamic";

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function BillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bill = await getBill(id);
  if (!bill) notFound();

  const savedShape = {
    id: bill.id,
    title: bill.title,
    date: bill.date,
    createdAt: bill.createdAt,
    people: bill.people.map((p) => ({ id: p.id, name: p.name })),
    items: bill.items.map((it) => ({
      id: it.id,
      name: it.name,
      price: it.price,
      shares: it.shares.map((s) => ({
        personId: s.personId,
        amount: s.amount,
      })),
    })),
    adjustments: bill.adjustments.map((a) => ({
      id: a.id,
      name: a.name,
      amount: a.amount,
      type: a.type,
      splitMode: a.splitMode,
    })),
  };

  const { perPerson, subtotal, adjustmentsTotal, grandTotal } =
    computeTotals(savedShape);

  // Data for the "by person" pie
  const byPerson = bill.people.map((p) => ({
    name: p.name,
    value: Math.max(0, perPerson[p.id] || 0),
  }));

  // Data for the "by item" pie
  const byItem = bill.items.map((it) => ({
    name: it.name,
    value: it.price,
  }));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-2 flex-wrap">
        <Link
          href="/"
          className="text-sm text-[color:var(--color-foreground-dim)] hover:text-white inline-flex items-center gap-1.5"
        >
          <ArrowLeft size={14} /> All bills
        </Link>
        <div className="flex items-center gap-2">
          <Link href={`/bills/${bill.id}/edit`} className="btn btn-ghost">
            <Pencil size={14} /> Edit
          </Link>
          <DeleteBillButton id={bill.id} />
        </div>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">{bill.title}</h1>
        <p className="text-sm text-[color:var(--color-foreground-dim)] mt-1 inline-flex items-center gap-1.5">
          <Calendar size={13} /> {formatDate(bill.date)}
          <span className="mx-1.5">·</span>
          {bill.people.length} people
          <span className="mx-1.5">·</span>
          {bill.items.length} items
        </p>
      </div>

      {/* Split cards grid */}
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[color:var(--color-foreground-dim)] mb-3">
        {bill.title} — {bill.people.length}-way split
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
        {bill.people.map((p) => {
          const lines = lineItemsForPerson(savedShape, p.id);
          return (
            <SplitCard
              key={p.id}
              name={p.name}
              total={perPerson[p.id] || 0}
              lines={lines}
            />
          );
        })}
      </div>

      {/* Totals bar */}
      <div className="card p-5 mb-10">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[color:var(--color-foreground-dim)]">
            Items subtotal
          </span>
          <span className="tabular-nums">{fmt(subtotal)}</span>
        </div>
        {adjustmentsTotal !== 0 && (
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-[color:var(--color-foreground-dim)]">
              Adjustments
            </span>
            <span className="tabular-nums">
              {adjustmentsTotal >= 0 ? "+" : "−"}
              {fmt(Math.abs(adjustmentsTotal))}
            </span>
          </div>
        )}
        <div className="border-t border-[color:var(--color-border)] my-3" />
        <div className="flex items-center justify-between">
          <span className="font-medium">Total ({bill.people.length} people)</span>
          <span className="text-lg font-semibold tabular-nums">
            {fmt(grandTotal)}
          </span>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        <SpendingPieChart data={byPerson} title="Spending by person" />
        <SpendingPieChart data={byItem} title="Spending by item" />
      </div>

      {/* Per-item breakdown table */}
      <div className="card p-5 overflow-x-auto">
        <h3 className="text-sm font-semibold tracking-tight mb-4">
          Per-item breakdown
        </h3>
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="text-left text-[color:var(--color-muted)] text-xs uppercase tracking-wider">
              <th className="pb-3 pr-4 font-medium">Item</th>
              <th className="pb-3 pr-4 font-medium text-right">Price</th>
              {bill.people.map((p) => (
                <th
                  key={p.id}
                  className="pb-3 pl-3 font-medium text-right truncate max-w-[100px]"
                >
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bill.items.map((it) => (
              <tr
                key={it.id}
                className="border-t border-[color:var(--color-border)]"
              >
                <td className="py-2.5 pr-4">{it.name}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-[color:var(--color-foreground-dim)]">
                  {fmt(it.price)}
                </td>
                {bill.people.map((p) => {
                  const amt =
                    it.shares.find((s) => s.personId === p.id)?.amount || 0;
                  return (
                    <td
                      key={p.id}
                      className="py-2.5 pl-3 text-right tabular-nums"
                    >
                      {amt > 0.0049 ? (
                        fmt(amt)
                      ) : (
                        <span className="text-[color:var(--color-muted)]">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {bill.adjustments.length > 0 && (
              <tr className="border-t-2 border-[color:var(--color-border-strong)]">
                <td className="py-2.5 pr-4 text-[color:var(--color-foreground-dim)] italic">
                  Adjustments
                </td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-[color:var(--color-foreground-dim)]">
                  {adjustmentsTotal >= 0 ? "+" : "−"}
                  {fmt(Math.abs(adjustmentsTotal))}
                </td>
                {bill.people.map((p) => {
                  const itemTotal = bill.items.reduce(
                    (a, it) =>
                      a +
                      (it.shares.find((s) => s.personId === p.id)?.amount || 0),
                    0,
                  );
                  const adj = (perPerson[p.id] || 0) - itemTotal;
                  return (
                    <td
                      key={p.id}
                      className="py-2.5 pl-3 text-right tabular-nums text-[color:var(--color-foreground-dim)]"
                    >
                      {Math.abs(adj) < 0.005 ? (
                        <span className="text-[color:var(--color-muted)]">—</span>
                      ) : adj >= 0 ? (
                        `+${fmt(adj)}`
                      ) : (
                        `−${fmt(Math.abs(adj))}`
                      )}
                    </td>
                  );
                })}
              </tr>
            )}
            <tr className="border-t-2 border-[color:var(--color-border-strong)] font-medium">
              <td className="py-3 pr-4">Total</td>
              <td className="py-3 pr-4 text-right tabular-nums">
                {fmt(grandTotal)}
              </td>
              {bill.people.map((p) => (
                <td
                  key={p.id}
                  className="py-3 pl-3 text-right tabular-nums font-semibold"
                >
                  {fmt(perPerson[p.id] || 0)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
