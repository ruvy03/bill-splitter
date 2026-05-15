"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { deleteBill } from "@/lib/actions";

export function DeleteBillButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="btn btn-danger-ghost"
      >
        <Trash2 size={14} /> Delete
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[color:var(--color-foreground-dim)]">
        Are you sure?
      </span>
      <button
        onClick={() => setConfirming(false)}
        className="btn btn-ghost !py-1.5 !px-3"
        disabled={pending}
      >
        Cancel
      </button>
      <button
        onClick={() =>
          startTransition(async () => {
            await deleteBill(id);
            router.push("/");
            router.refresh();
          })
        }
        className="btn !bg-rose-500/90 !text-white hover:!bg-rose-500 !py-1.5 !px-3"
        disabled={pending}
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : "Delete"}
      </button>
    </div>
  );
}
