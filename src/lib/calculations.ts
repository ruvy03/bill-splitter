/**
 * Split / adjustment math.
 *
 * All dollar amounts are kept as floating-point JS numbers but rounded to cents
 * wherever they leave this module (either for display or for persistence).
 */

import type {
  DraftAdjustment,
  DraftBill,
  DraftItem,
  DraftPerson,
  SavedBill,
} from "./types";

/** Round to cents. */
export const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Tiny deterministic PRNG (mulberry32 seeded by an FNV-1a hash of `seedKey`).
 * Used to pick which lucky people absorb the leftover cents when a price
 * doesn't divide evenly. Deterministic so the same item id always produces
 * the same overflow assignment across re-renders.
 */
function seededShuffle<T>(arr: T[], seedKey: string): T[] {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedKey.length; i++) {
    h ^= seedKey.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const rand = () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Round per-person dollar shares to whole cents so they sum *exactly* to
 * `targetPrice`. Floor each share to cents, then distribute any leftover
 * cents one-by-one to a random subset of eligible recipients (people whose
 * raw share was > 0). Random pick is seeded by `seedKey` for stability.
 */
export function reconcileSharesToCents(
  raw: Record<string, number>,
  targetPrice: number,
  seedKey: string,
): Record<string, number> {
  const targetCents = Math.round(targetPrice * 100);
  const ids = Object.keys(raw);
  const flooredCents: Record<string, number> = {};
  let sum = 0;
  for (const id of ids) {
    const c = Math.floor((raw[id] || 0) * 100);
    flooredCents[id] = c;
    sum += c;
  }
  let leftover = targetCents - sum;
  // Eligible recipients: people who actually have a share in this item.
  const eligible = ids.filter((id) => (raw[id] || 0) > 0);
  if (eligible.length > 0 && leftover > 0) {
    const order = seededShuffle(eligible, seedKey);
    for (let i = 0; leftover > 0; i++) {
      flooredCents[order[i % order.length]] += 1;
      leftover -= 1;
    }
  }
  const out: Record<string, number> = {};
  for (const id of ids) out[id] = flooredCents[id] / 100;
  return out;
}

/** Format as USD currency. */
export const fmt = (n: number): string =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * For a single item, compute each person's resolved dollar share.
 * Returns a map of personId -> dollars.
 *
 * - In "even" mode, the price is split equally among included people.
 * - In "percent" mode, each included person's `value` is a percentage;
 *   the shares are normalized so they sum to 100% before multiplying.
 * - In "amount" mode, each included person's `value` is a dollar amount.
 *   If they don't sum to the price, we scale proportionally so they do
 *   (so the math always reconciles to the item price).
 *
 * People who are not `included` always get 0.
 */
export function resolveItemShares(item: DraftItem): Record<string, number> {
  const included = item.shares.filter((s) => s.included);
  const out: Record<string, number> = {};
  for (const s of item.shares) out[s.personId] = 0;

  if (included.length === 0 || item.price === 0) return out;

  if (item.splitMode === "even") {
    const each = item.price / included.length;
    for (const s of included) out[s.personId] = each;
  } else if (item.splitMode === "percent") {
    const sum = included.reduce((a, s) => a + (s.value || 0), 0);
    if (sum === 0) {
      const each = item.price / included.length;
      for (const s of included) out[s.personId] = each;
    } else {
      for (const s of included) {
        out[s.personId] = item.price * ((s.value || 0) / sum);
      }
    }
  } else {
    // "amount" mode
    const sum = included.reduce((a, s) => a + (s.value || 0), 0);
    if (sum === 0) {
      const each = item.price / included.length;
      for (const s of included) out[s.personId] = each;
    } else {
      // scale to exactly match the item price so totals always reconcile
      const scale = item.price / sum;
      for (const s of included) out[s.personId] = (s.value || 0) * scale;
    }
  }

  // Finalize to whole cents and push any leftover pennies onto a stable-
  // randomly-selected subset of included people. Without this, a $10 item
  // split 3 ways would round to 3.33 × 3 = $9.99 and lose a cent — here the
  // odd cent goes to one of the three (deterministically, by item id).
  return reconcileSharesToCents(out, item.price, item.id);
}

/** Sum of item prices (pre-adjustment subtotal). */
export function subtotal(items: DraftItem[]): number {
  return items.reduce((a, it) => a + (it.price || 0), 0);
}

/** Per-person subtotal (sum of all item shares for that person), pre-adjustments. */
export function perPersonSubtotal(items: DraftItem[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const it of items) {
    const shares = resolveItemShares(it);
    for (const [pid, amt] of Object.entries(shares)) {
      totals[pid] = (totals[pid] || 0) + amt;
    }
  }
  return totals;
}

/**
 * Distribute one adjustment (tax / fee / discount) across people.
 * Discounts are applied as negative amounts here.
 */
export function distributeAdjustment(
  adj: DraftAdjustment,
  people: DraftPerson[],
  itemTotals: Record<string, number>,
  itemSubtotal: number,
): Record<string, number> {
  const signed = adj.type === "discount" ? -adj.amount : adj.amount;
  const out: Record<string, number> = {};
  for (const p of people) out[p.id] = 0;

  if (people.length === 0) return out;

  if (adj.splitMode === "even") {
    const each = signed / people.length;
    for (const p of people) out[p.id] = each;
    return out;
  }

  // proportional: by each person's item subtotal
  if (itemSubtotal === 0) {
    // no items yet — fall back to even
    const each = signed / people.length;
    for (const p of people) out[p.id] = each;
    return out;
  }
  for (const p of people) {
    const share = (itemTotals[p.id] || 0) / itemSubtotal;
    out[p.id] = signed * share;
  }
  return out;
}

/**
 * Final totals per person, including all adjustments.
 * Returns { perPerson: { id -> total }, adjustmentsTotal, grandTotal }.
 */
export function computeTotals(bill: DraftBill | SavedBillLike) {
  const items = normalizeItems(bill);
  const itemTotals = perPersonSubtotal(items);
  const sub = subtotal(items);

  const people: DraftPerson[] = bill.people.map((p) => ({
    id: p.id,
    name: p.name,
  }));

  let adjustmentsTotal = 0;
  const perPerson: Record<string, number> = { ...itemTotals };
  for (const p of people)
    if (perPerson[p.id] === undefined) perPerson[p.id] = 0;

  const adjustments: DraftAdjustment[] =
    "adjustments" in bill ? (bill.adjustments as DraftAdjustment[]) : [];

  for (const adj of adjustments) {
    const signed = adj.type === "discount" ? -adj.amount : adj.amount;
    adjustmentsTotal += signed;
    const dist = distributeAdjustment(adj, people, itemTotals, sub);
    for (const [pid, amt] of Object.entries(dist)) {
      perPerson[pid] = (perPerson[pid] || 0) + amt;
    }
  }

  const grandTotal = sub + adjustmentsTotal;
  return { perPerson, itemTotals, subtotal: sub, adjustmentsTotal, grandTotal };
}

/**
 * Small shim: both DraftBill and a SavedBill-shaped object can be passed in.
 * The SavedBill items use `shares: {personId, amount}[]` (already resolved);
 * we convert them into a DraftItem-like structure with splitMode "amount" and
 * included=true so resolveItemShares returns the stored amounts unchanged.
 */
type SavedBillLike = {
  people: { id: string; name: string }[];
  items: {
    id: string;
    name: string;
    price: number;
    shares: { personId: string; amount: number }[];
  }[];
  adjustments: {
    id: string;
    name: string;
    amount: number;
    type: string;
    splitMode: string;
  }[];
};

function normalizeItems(bill: DraftBill | SavedBillLike): DraftItem[] {
  // Discriminate by item shape rather than `title`: a SavedBill loaded from the
  // detail page is wrapped in an object that also carries `title`, so checking
  // `"title" in bill` would misclassify it as a DraftBill and skip normalization.
  const first = bill.items[0] as { splitMode?: string } | undefined;
  if (!first || "splitMode" in first) return (bill as DraftBill).items;
  const saved = bill as SavedBillLike;
  return saved.items.map((it) => ({
    id: it.id,
    name: it.name,
    price: it.price,
    splitMode: "amount",
    shares: it.shares.map((s) => ({
      personId: s.personId,
      value: s.amount,
      included: s.amount > 0,
    })),
  }));
}

/** Human label for item lines that appear in a person's split card. */
export function lineItemsForPerson(
  bill: SavedBill,
  personId: string,
): { label: string; amount: number }[] {
  const lines: { label: string; amount: number }[] = [];

  for (const it of bill.items) {
    const share = it.shares.find((s) => s.personId === personId);
    if (share && share.amount > 0.0049) {
      lines.push({ label: it.name, amount: round2(share.amount) });
    }
  }

  // Roll tax + all fees into a single "Tax + fees" line, and discounts into
  // a separate "Discounts" line, just like the reference screenshot.
  const itemTotals = perPersonSubtotal(
    bill.items.map((it) => ({
      id: it.id,
      name: it.name,
      price: it.price,
      splitMode: "amount" as const,
      shares: it.shares.map((s) => ({
        personId: s.personId,
        value: s.amount,
        included: s.amount > 0,
      })),
    })),
  );
  const sub = bill.items.reduce((a, it) => a + it.price, 0);
  const people = bill.people;

  let taxFees = 0;
  let discounts = 0;
  for (const adj of bill.adjustments) {
    const dist = distributeAdjustment(
      {
        id: adj.id,
        name: adj.name,
        amount: adj.amount,
        type: adj.type as "tax" | "fee" | "discount",
        splitMode: adj.splitMode as "proportional" | "even",
      },
      people,
      itemTotals,
      sub,
    );
    const v = dist[personId] || 0;
    if (adj.type === "discount") discounts += v;
    else taxFees += v;
  }
  if (Math.abs(taxFees) > 0.0049)
    lines.push({ label: "Tax + fees", amount: round2(taxFees) });
  if (Math.abs(discounts) > 0.0049)
    lines.push({ label: "Discounts", amount: round2(discounts) });

  return lines;
}
