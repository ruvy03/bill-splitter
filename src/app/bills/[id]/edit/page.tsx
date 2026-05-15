import { notFound } from "next/navigation";
import { EditBillClient } from "./EditBillClient";
import { getBill } from "@/lib/actions";
import type { DraftBill } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Convert a saved bill (with already-resolved per-person amounts on each item)
 * back into a DraftBill the wizard can edit.
 *
 * We don't know each item's original splitMode (it isn't stored), so every
 * item comes back as `splitMode: "amount"` with the stored dollar values
 * preserved verbatim. The user can switch back to "even"/"%" in the wizard;
 * doing so reseeds the values from an even split, which is the same behavior
 * as creating a brand-new item.
 */
function toDraft(bill: NonNullable<Awaited<ReturnType<typeof getBill>>>): DraftBill {
  const isoDate = new Date(bill.date).toISOString().slice(0, 10);
  return {
    title: bill.title,
    date: isoDate,
    people: bill.people.map((p) => ({ id: p.id, name: p.name })),
    items: bill.items.map((it) => {
      // For each person, build a share row. People without a stored share
      // are excluded (included=false, value=0).
      const shareByPerson = new Map(
        it.shares.map((s) => [s.personId, s.amount]),
      );
      return {
        id: it.id,
        name: it.name,
        price: it.price,
        splitMode: "amount" as const,
        shares: bill.people.map((p) => {
          const amt = shareByPerson.get(p.id);
          return {
            personId: p.id,
            value: amt ?? 0,
            included: amt !== undefined && amt > 0,
          };
        }),
      };
    }),
    adjustments: bill.adjustments.map((a) => ({
      id: a.id,
      name: a.name,
      amount: a.amount,
      type: a.type as DraftBill["adjustments"][number]["type"],
      splitMode:
        a.splitMode as DraftBill["adjustments"][number]["splitMode"],
    })),
  };
}

export default async function EditBillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bill = await getBill(id);
  if (!bill) notFound();

  const draft = toDraft(bill);
  return <EditBillClient billId={id} initial={draft} />;
}
