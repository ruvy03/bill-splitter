"use client";

import { BillForm } from "@/components/BillForm";
import { createBill } from "@/lib/actions";
import type { DraftBill } from "@/lib/types";

const todayIso = () => {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
};

export default function NewBillPage() {
  const initial: DraftBill = {
    title: "",
    date: todayIso(),
    people: [],
    items: [],
    adjustments: [],
  };
  return (
    <BillForm
      initial={initial}
      mode="create"
      cancelHref="/"
      onSubmit={async (bill) => {
        await createBill(bill);
      }}
    />
  );
}
