"use client";

import { BillForm } from "@/components/BillForm";
import { updateBill } from "@/lib/actions";
import type { DraftBill } from "@/lib/types";

export function EditBillClient({
  billId,
  initial,
}: {
  billId: string;
  initial: DraftBill;
}) {
  return (
    <BillForm
      initial={initial}
      mode="edit"
      cancelHref={`/bills/${billId}`}
      onSubmit={async (bill) => {
        await updateBill(billId, bill);
      }}
    />
  );
}
