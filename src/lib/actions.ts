"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import type { DraftBill } from "./types";
import { resolveItemShares, round2 } from "./calculations";

/** Persist a completed draft bill and redirect to its detail page. */
export async function createBill(draft: DraftBill) {
  // Map client-local person ids -> cuids we persist.
  const personIdMap = new Map<string, string>();

  // 1. Create the bill shell.
  const createdBill = await prisma.bill.create({
    data: {
      title: draft.title.trim() || "Untitled bill",
      date: new Date(draft.date),
    },
  });

  // 2. Create each person sequentially so we know exactly which persisted row
  //    corresponds to each draft person id (names can repeat, so we can't rely
  //    on name matching).
  for (const p of draft.people) {
    const created = await prisma.person.create({
      data: {
        name: p.name.trim() || "Person",
        billId: createdBill.id,
      },
    });
    personIdMap.set(p.id, created.id);
  }

  // 3. Create items + their shares.
  for (const item of draft.items) {
    const shares = resolveItemShares(item);
    await prisma.item.create({
      data: {
        name: item.name.trim() || "Item",
        price: round2(item.price),
        billId: createdBill.id,
        shares: {
          create: Object.entries(shares)
            .filter(([, amt]) => amt > 0.0049)
            .map(([draftPid, amt]) => ({
              personId: personIdMap.get(draftPid)!,
              amount: round2(amt),
            })),
        },
      },
    });
  }

  // 4. Create adjustments.
  for (const adj of draft.adjustments) {
    await prisma.adjustment.create({
      data: {
        name: adj.name.trim() || adj.type,
        amount: round2(adj.amount),
        type: adj.type,
        splitMode: adj.splitMode,
        billId: createdBill.id,
      },
    });
  }

  revalidatePath("/");
  redirect(`/bills/${createdBill.id}`);
}

/**
 * Replace an existing bill's contents with a new draft.
 *
 * Strategy:
 *   - bill row: update title + date in place.
 *   - people:  preserve any DB person whose id is still present in the draft
 *              (so historical references stay intact); delete those that were
 *              removed; create rows for any draft person whose id isn't yet
 *              persisted (newly added during the edit).
 *   - items + shares + adjustments: simplest correct approach is to delete
 *              and recreate. ItemShare cascades from Item; Adjustment is its
 *              own table. This avoids a complex per-row diff and keeps the
 *              save path identical to createBill.
 */
export async function updateBill(billId: string, draft: DraftBill) {
  const existingBill = await prisma.bill.findUnique({
    where: { id: billId },
    include: { people: true },
  });
  if (!existingBill) throw new Error("Bill not found");

  await prisma.bill.update({
    where: { id: billId },
    data: {
      title: draft.title.trim() || "Untitled bill",
      date: new Date(draft.date),
    },
  });

  const draftIds = new Set(draft.people.map((p) => p.id));
  const existingIds = new Set(existingBill.people.map((p) => p.id));

  // Remove people that are no longer in the draft (cascades their shares).
  const toDelete = existingBill.people
    .filter((p) => !draftIds.has(p.id))
    .map((p) => p.id);
  if (toDelete.length > 0) {
    await prisma.person.deleteMany({ where: { id: { in: toDelete } } });
  }

  // Map draft.people[].id -> persisted id. For people already in the DB, the
  // id IS the persisted id. For newly added people the draft id is a local
  // uid; create them and remember the new persisted id.
  const personIdMap = new Map<string, string>();
  for (const p of draft.people) {
    if (existingIds.has(p.id)) {
      await prisma.person.update({
        where: { id: p.id },
        data: { name: p.name.trim() || "Person" },
      });
      personIdMap.set(p.id, p.id);
    } else {
      const created = await prisma.person.create({
        data: { name: p.name.trim() || "Person", billId },
      });
      personIdMap.set(p.id, created.id);
    }
  }

  // Wipe and recreate items + adjustments.
  await prisma.item.deleteMany({ where: { billId } });
  await prisma.adjustment.deleteMany({ where: { billId } });

  for (const item of draft.items) {
    const shares = resolveItemShares(item);
    await prisma.item.create({
      data: {
        name: item.name.trim() || "Item",
        price: round2(item.price),
        billId,
        shares: {
          create: Object.entries(shares)
            .filter(([, amt]) => amt > 0.0049)
            .map(([draftPid, amt]) => ({
              personId: personIdMap.get(draftPid)!,
              amount: round2(amt),
            })),
        },
      },
    });
  }

  for (const adj of draft.adjustments) {
    await prisma.adjustment.create({
      data: {
        name: adj.name.trim() || adj.type,
        amount: round2(adj.amount),
        type: adj.type,
        splitMode: adj.splitMode,
        billId,
      },
    });
  }

  revalidatePath("/");
  revalidatePath(`/bills/${billId}`);
  redirect(`/bills/${billId}`);
}

export async function deleteBill(id: string) {
  await prisma.bill.delete({ where: { id } });
  revalidatePath("/");
}

export async function listBills() {
  return prisma.bill.findMany({
    orderBy: { date: "desc" },
    include: {
      people: true,
      items: { include: { shares: true } },
      adjustments: true,
    },
  });
}

export async function getBill(id: string) {
  return prisma.bill.findUnique({
    where: { id },
    include: {
      people: true,
      items: { include: { shares: true } },
      adjustments: true,
    },
  });
}
