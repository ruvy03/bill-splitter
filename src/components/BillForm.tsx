"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Percent,
  Plus,
  Trash2,
  Users,
  DollarSign,
  Calendar,
  Tag,
  Loader2,
  PlusCircle,
} from "lucide-react";
import {
  computeTotals,
  fmt,
  perPersonSubtotal,
  resolveItemShares,
} from "@/lib/calculations";
import type {
  DraftAdjustment,
  DraftBill,
  DraftItem,
  DraftPerson,
  SplitMode,
} from "@/lib/types";

const uid = () => Math.random().toString(36).slice(2, 10);

type Step = 0 | 1 | 2 | 3;
const STEPS: { title: string; hint: string }[] = [
  { title: "Title", hint: "Name your bill" },
  { title: "People", hint: "Who's splitting it?" },
  { title: "Items", hint: "Add what was bought" },
  { title: "Adjustments", hint: "Tax, fees, discounts" },
];

export function BillForm({
  initial,
  mode,
  onSubmit,
  cancelHref,
}: {
  initial: DraftBill;
  mode: "create" | "edit";
  onSubmit: (bill: DraftBill) => Promise<void>;
  cancelHref: string;
}) {
  // For edits, jump straight to Items — that's almost always why someone
  // clicked "Edit". Step indicators still let them go anywhere.
  const [step, setStep] = useState<Step>(mode === "edit" ? 2 : 0);
  const [bill, setBill] = useState<DraftBill>(initial);
  const [pending, startTransition] = useTransition();

  const canAdvance = useMemo(() => {
    if (step === 0) return bill.title.trim().length > 0;
    if (step === 1)
      return (
        bill.people.length >= 2 &&
        bill.people.every((p) => p.name.trim().length > 0)
      );
    if (step === 2) return bill.items.length > 0;
    return true;
  }, [step, bill]);

  const handleSubmit = () => {
    startTransition(async () => {
      await onSubmit(bill);
    });
  };

  const submitIdleLabel = mode === "edit" ? "Save changes" : "Create bill";
  const submitPendingLabel = mode === "edit" ? "Saving…" : "Saving…";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Link
          href={cancelHref}
          className="text-sm text-[color:var(--color-foreground-dim)] hover:text-white inline-flex items-center gap-1.5"
        >
          <ArrowLeft size={14} /> {mode === "edit" ? "Cancel" : "Back"}
        </Link>
        <StepDots step={step} onJump={(s) => setStep(s)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        {/* Main form column */}
        <div className="card p-6 min-h-[520px]">
          <div className="mb-5">
            <h2 className="text-xl font-semibold tracking-tight">
              {STEPS[step].title}
            </h2>
            <p className="text-sm text-[color:var(--color-foreground-dim)] mt-0.5">
              {STEPS[step].hint}
            </p>
          </div>

          {step === 0 && <StepTitle bill={bill} setBill={setBill} />}
          {step === 1 && <StepPeople bill={bill} setBill={setBill} />}
          {step === 2 && <StepItems bill={bill} setBill={setBill} />}
          {step === 3 && <StepAdjustments bill={bill} setBill={setBill} />}

          {/* Nav buttons */}
          <div className="mt-8 pt-5 border-t border-[color:var(--color-border)] flex items-center justify-between gap-2 flex-wrap">
            <button
              className="btn btn-ghost"
              onClick={() => setStep((s) => (s > 0 ? ((s - 1) as Step) : s))}
              disabled={step === 0}
            >
              <ArrowLeft size={14} /> Back
            </button>

            <div className="flex items-center gap-2">
              {/* On edit, allow saving from any step (not just the last). */}
              {mode === "edit" && step < 3 && (
                <button
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={pending || bill.items.length === 0}
                >
                  {pending ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />{" "}
                      {submitPendingLabel}
                    </>
                  ) : (
                    <>
                      <Check size={14} /> {submitIdleLabel}
                    </>
                  )}
                </button>
              )}

              {step < 3 ? (
                <button
                  className="btn btn-ghost"
                  onClick={() => setStep((s) => (s + 1) as Step)}
                  disabled={!canAdvance}
                >
                  Next <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={pending || bill.items.length === 0}
                >
                  {pending ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />{" "}
                      {submitPendingLabel}
                    </>
                  ) : (
                    <>
                      <Check size={14} /> {submitIdleLabel}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Live preview sidebar */}
        <PreviewPanel bill={bill} />
      </div>
    </div>
  );
}

/* ----- step indicator ------------------------------------------------ */

function StepDots({
  step,
  onJump,
}: {
  step: Step;
  onJump: (s: Step) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {STEPS.map((s, i) => (
        <button
          key={s.title}
          type="button"
          onClick={() => onJump(i as Step)}
          aria-label={`Go to ${s.title}`}
          className={`h-1.5 rounded-full transition-all cursor-pointer ${
            i === step
              ? "w-8 bg-[color:var(--color-accent)]"
              : i < step
                ? "w-5 bg-[color:var(--color-accent-dim)]"
                : "w-5 bg-[color:var(--color-border)]"
          }`}
        />
      ))}
    </div>
  );
}

/* ----- step 0: title + date ------------------------------------------ */

function StepTitle({
  bill,
  setBill,
}: {
  bill: DraftBill;
  setBill: (u: (b: DraftBill) => DraftBill) => void;
}) {
  return (
    <div className="space-y-5 max-w-md">
      <div>
        <label className="block text-xs font-medium text-[color:var(--color-foreground-dim)] mb-1.5 uppercase tracking-wide">
          Title
        </label>
        <input
          autoFocus
          className="input"
          placeholder="e.g. Costco run, Dinner at Lulu's"
          value={bill.title}
          onChange={(e) =>
            setBill((b) => ({ ...b, title: e.target.value }))
          }
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-[color:var(--color-foreground-dim)] mb-1.5 uppercase tracking-wide">
          <span className="inline-flex items-center gap-1">
            <Calendar size={12} /> Date
          </span>
        </label>
        <input
          type="date"
          className="input"
          value={bill.date}
          onChange={(e) => setBill((b) => ({ ...b, date: e.target.value }))}
        />
      </div>
    </div>
  );
}

/* ----- step 1: people ------------------------------------------------ */

function StepPeople({
  bill,
  setBill,
}: {
  bill: DraftBill;
  setBill: (u: (b: DraftBill) => DraftBill) => void;
}) {
  const setCount = (n: number) => {
    setBill((b) => {
      const current = b.people.length;
      if (n === current) return b;
      if (n > current) {
        const added: DraftPerson[] = Array.from(
          { length: n - current },
          (_, i) => ({ id: uid(), name: `Person ${current + i + 1}` }),
        );
        return { ...b, people: [...b.people, ...added] };
      }
      const kept = b.people.slice(0, n);
      const keptIds = new Set(kept.map((p) => p.id));
      return {
        ...b,
        people: kept,
        items: b.items.map((it) => ({
          ...it,
          shares: it.shares.filter((s) => keptIds.has(s.personId)),
        })),
      };
    });
  };

  const updateName = (id: string, name: string) =>
    setBill((b) => ({
      ...b,
      people: b.people.map((p) => (p.id === id ? { ...p, name } : p)),
    }));

  const removePerson = (id: string) =>
    setBill((b) => ({
      ...b,
      people: b.people.filter((p) => p.id !== id),
      items: b.items.map((it) => ({
        ...it,
        shares: it.shares.filter((s) => s.personId !== id),
      })),
    }));

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-medium text-[color:var(--color-foreground-dim)] mb-2 uppercase tracking-wide">
          <span className="inline-flex items-center gap-1">
            <Users size={12} /> Number of people
          </span>
        </label>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-ghost size-9 !p-0"
            onClick={() => setCount(Math.max(0, bill.people.length - 1))}
            aria-label="Remove person"
          >
            −
          </button>
          <div className="text-2xl font-semibold w-10 text-center tabular-nums">
            {bill.people.length}
          </div>
          <button
            className="btn btn-ghost size-9 !p-0"
            onClick={() => setCount(bill.people.length + 1)}
            aria-label="Add person"
          >
            +
          </button>
          <span className="ml-3 text-xs text-[color:var(--color-muted)]">
            Minimum 2
          </span>
        </div>
      </div>

      {bill.people.length > 0 && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-[color:var(--color-foreground-dim)] uppercase tracking-wide">
            Names
          </label>
          <div className="space-y-2">
            {bill.people.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="text-xs text-[color:var(--color-muted)] w-6 tabular-nums">
                  {i + 1}.
                </span>
                <input
                  className="input"
                  placeholder={`Person ${i + 1}`}
                  value={p.name}
                  onChange={(e) => updateName(p.id, e.target.value)}
                />
                <button
                  className="btn btn-danger-ghost size-9 !p-0"
                  onClick={() => removePerson(p.id)}
                  aria-label="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ----- step 2: items ------------------------------------------------- */

function StepItems({
  bill,
  setBill,
}: {
  bill: DraftBill;
  setBill: (u: (b: DraftBill) => DraftBill) => void;
}) {
  const addItem = () =>
    setBill((b) => {
      const n = b.items.length + 1;
      const newItem: DraftItem = {
        id: uid(),
        name: `Item ${n}`,
        price: 0,
        splitMode: "even",
        shares: b.people.map((p) => ({
          personId: p.id,
          value: 0,
          included: true,
        })),
      };
      return { ...b, items: [...b.items, newItem] };
    });

  const removeItem = (id: string) =>
    setBill((b) => ({ ...b, items: b.items.filter((it) => it.id !== id) }));

  const updateItem = (id: string, patch: Partial<DraftItem>) =>
    setBill((b) => ({
      ...b,
      items: b.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    }));

  return (
    <div className="space-y-3">
      {bill.items.length === 0 && (
        <div className="text-sm text-[color:var(--color-muted)] text-center py-8 border border-dashed border-[color:var(--color-border)] rounded-xl">
          No items yet. Add your first item below.
        </div>
      )}

      {bill.items.map((item, i) => (
        <ItemCard
          key={item.id}
          index={i}
          item={item}
          people={bill.people}
          onChange={(patch) => updateItem(item.id, patch)}
          onRemove={() => removeItem(item.id)}
        />
      ))}

      <button onClick={addItem} className="btn-add-item w-full">
        <span className="btn-add-item-icon">
          <PlusCircle size={18} strokeWidth={2.25} />
        </span>
        <span>Add item</span>
        <span className="btn-add-item-hint">
          {bill.items.length === 0 ? "Start here" : `${bill.items.length} so far`}
        </span>
      </button>
    </div>
  );
}

function ItemCard({
  index,
  item,
  people,
  onChange,
  onRemove,
}: {
  index: number;
  item: DraftItem;
  people: DraftPerson[];
  onChange: (patch: Partial<DraftItem>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const shares = useMemo(() => {
    const existing = new Map(item.shares.map((s) => [s.personId, s]));
    return people.map(
      (p) =>
        existing.get(p.id) ?? {
          personId: p.id,
          value: 0,
          included: true,
        },
    );
  }, [item.shares, people]);

  const includedCount = shares.filter((s) => s.included).length;

  const changeShare = (
    personId: string,
    patch: Partial<(typeof shares)[number]>,
  ) =>
    onChange({
      shares: shares.map((s) =>
        s.personId === personId ? { ...s, ...patch } : s,
      ),
    });

  const setMode = (splitMode: SplitMode) => {
    if (splitMode === "percent") {
      const even = includedCount > 0 ? 100 / includedCount : 0;
      onChange({
        splitMode,
        shares: shares.map((s) => ({ ...s, value: s.included ? even : 0 })),
      });
      return;
    }
    if (splitMode === "amount") {
      const even = includedCount > 0 ? item.price / includedCount : 0;
      onChange({
        splitMode,
        shares: shares.map((s) => ({ ...s, value: s.included ? even : 0 })),
      });
      return;
    }
    onChange({ splitMode });
  };

  const resolved = resolveItemShares({ ...item, shares });

  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-[#0f0f11]">
      <div className="p-3.5 flex items-center gap-2">
        <span className="text-xs text-[color:var(--color-muted)] w-7 tabular-nums shrink-0">
          #{index + 1}
        </span>
        <input
          className="input !py-1.5 !px-2.5 flex-1 min-w-0"
          placeholder={`Item ${index + 1}`}
          value={item.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <div className="relative shrink-0 w-28">
          <DollarSign
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--color-muted)]"
          />
          <input
            type="number"
            step="0.01"
            min="0"
            className="input !py-1.5 !pl-7 !pr-2 text-right"
            placeholder="0.00"
            value={item.price === 0 ? "" : item.price}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              onChange({ price: Number.isFinite(v) ? v : 0 });
            }}
          />
        </div>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="btn btn-ghost !px-2.5 !py-1.5 text-xs shrink-0"
        >
          {expanded ? "Hide" : "Split"}
        </button>
        <button
          onClick={onRemove}
          className="btn btn-danger-ghost size-8 !p-0 shrink-0"
          aria-label="Remove item"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-[color:var(--color-border)] p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs text-[color:var(--color-foreground-dim)]">
              Split mode
            </div>
            <div className="seg">
              <button
                onClick={() => setMode("even")}
                className={item.splitMode === "even" ? "active" : ""}
              >
                Even
              </button>
              <button
                onClick={() => setMode("percent")}
                className={item.splitMode === "percent" ? "active" : ""}
              >
                %
              </button>
              <button
                onClick={() => setMode("amount")}
                className={item.splitMode === "amount" ? "active" : ""}
              >
                $
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            {shares.map((s) => {
              const person = people.find((p) => p.id === s.personId);
              if (!person) return null;
              return (
                <div key={s.personId} className="flex items-center gap-2">
                  <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={s.included}
                      onChange={(e) =>
                        changeShare(s.personId, { included: e.target.checked })
                      }
                      className="size-4 rounded accent-[color:var(--color-accent)]"
                    />
                    <span className="text-sm truncate">{person.name}</span>
                  </label>

                  {item.splitMode === "even" && (
                    <span className="text-sm text-[color:var(--color-foreground-dim)] tabular-nums w-20 text-right">
                      {s.included ? fmt(resolved[s.personId] || 0) : "—"}
                    </span>
                  )}

                  {item.splitMode === "percent" && (
                    <div className="relative w-24">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        disabled={!s.included}
                        className="input !py-1 !pr-6 !pl-2 text-right text-sm disabled:opacity-40"
                        value={s.value || ""}
                        onChange={(e) =>
                          changeShare(s.personId, {
                            value: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                      <Percent
                        size={11}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[color:var(--color-muted)]"
                      />
                    </div>
                  )}

                  {item.splitMode === "amount" && (
                    <div className="relative w-24">
                      <DollarSign
                        size={11}
                        className="absolute left-2 top-1/2 -translate-y-1/2 text-[color:var(--color-muted)]"
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        disabled={!s.included}
                        className="input !py-1 !pl-6 !pr-2 text-right text-sm disabled:opacity-40"
                        value={s.value || ""}
                        onChange={(e) =>
                          changeShare(s.personId, {
                            value: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {item.splitMode === "percent" && (
            <PercentHint shares={shares} />
          )}
          {item.splitMode === "amount" && (
            <AmountHint shares={shares} price={item.price} />
          )}
        </div>
      )}
    </div>
  );
}

function PercentHint({
  shares,
}: {
  shares: { included: boolean; value: number }[];
}) {
  const sum = shares.reduce((a, s) => a + (s.included ? s.value || 0 : 0), 0);
  const off = Math.abs(sum - 100);
  if (off < 0.05) return null;
  return (
    <p className="text-xs text-amber-400/90">
      Percentages sum to {sum.toFixed(1)}%. They&apos;ll be normalized to 100% on save.
    </p>
  );
}

function AmountHint({
  shares,
  price,
}: {
  shares: { included: boolean; value: number }[];
  price: number;
}) {
  const sum = shares.reduce((a, s) => a + (s.included ? s.value || 0 : 0), 0);
  if (price === 0) return null;
  const off = Math.abs(sum - price);
  if (off < 0.01) return null;
  return (
    <p className="text-xs text-amber-400/90">
      Shares sum to {fmt(sum)}, item is {fmt(price)}. They&apos;ll be scaled
      proportionally on save.
    </p>
  );
}

/* ----- step 3: adjustments ------------------------------------------- */

function StepAdjustments({
  bill,
  setBill,
}: {
  bill: DraftBill;
  setBill: (u: (b: DraftBill) => DraftBill) => void;
}) {
  const addAdjustment = (type: DraftAdjustment["type"]) => {
    const defaults: Record<DraftAdjustment["type"], string> = {
      tax: "Sales tax",
      fee: "Service fee",
      discount: "Discount",
    };
    setBill((b) => ({
      ...b,
      adjustments: [
        ...b.adjustments,
        {
          id: uid(),
          name: defaults[type],
          amount: 0,
          type,
          splitMode: "proportional",
        },
      ],
    }));
  };

  const updateAdj = (id: string, patch: Partial<DraftAdjustment>) =>
    setBill((b) => ({
      ...b,
      adjustments: b.adjustments.map((a) =>
        a.id === id ? { ...a, ...patch } : a,
      ),
    }));

  const removeAdj = (id: string) =>
    setBill((b) => ({
      ...b,
      adjustments: b.adjustments.filter((a) => a.id !== id),
    }));

  return (
    <div className="space-y-4">
      <p className="text-sm text-[color:var(--color-foreground-dim)]">
        Add tax, fees, or discounts. Choose whether each is distributed{" "}
        <span className="text-white">proportionally</span> (by how much each
        person spent) or <span className="text-white">evenly</span>.
      </p>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => addAdjustment("tax")} className="btn btn-ghost">
          <Plus size={14} /> Tax
        </button>
        <button onClick={() => addAdjustment("fee")} className="btn btn-ghost">
          <Plus size={14} /> Fee
        </button>
        <button
          onClick={() => addAdjustment("discount")}
          className="btn btn-ghost"
        >
          <Plus size={14} /> Discount
        </button>
      </div>

      {bill.adjustments.length === 0 && (
        <div className="text-sm text-[color:var(--color-muted)] text-center py-8 border border-dashed border-[color:var(--color-border)] rounded-xl">
          No adjustments. You can skip this step.
        </div>
      )}

      <div className="space-y-2.5">
        {bill.adjustments.map((adj) => (
          <div
            key={adj.id}
            className="rounded-xl border border-[color:var(--color-border)] bg-[#0f0f11] p-3.5 space-y-3"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                  adj.type === "tax"
                    ? "bg-blue-500/15 text-blue-300"
                    : adj.type === "fee"
                      ? "bg-purple-500/15 text-purple-300"
                      : "bg-rose-500/15 text-rose-300"
                }`}
              >
                <Tag size={10} className="inline mr-1" />
                {adj.type}
              </span>
              <input
                className="input !py-1.5 !px-2.5 flex-1 min-w-0"
                placeholder="Name"
                value={adj.name}
                onChange={(e) => updateAdj(adj.id, { name: e.target.value })}
              />
              <div className="relative shrink-0 w-28">
                <DollarSign
                  size={12}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--color-muted)]"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input !py-1.5 !pl-7 !pr-2 text-right"
                  placeholder="0.00"
                  value={adj.amount === 0 ? "" : adj.amount}
                  onChange={(e) =>
                    updateAdj(adj.id, {
                      amount: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <button
                onClick={() => removeAdj(adj.id)}
                className="btn btn-danger-ghost size-8 !p-0 shrink-0"
                aria-label="Remove"
              >
                <Trash2 size={13} />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-xs text-[color:var(--color-foreground-dim)]">
                Split mode
              </div>
              <div className="seg">
                <button
                  onClick={() =>
                    updateAdj(adj.id, { splitMode: "proportional" })
                  }
                  className={adj.splitMode === "proportional" ? "active" : ""}
                >
                  Proportional
                </button>
                <button
                  onClick={() => updateAdj(adj.id, { splitMode: "even" })}
                  className={adj.splitMode === "even" ? "active" : ""}
                >
                  Even
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----- live preview -------------------------------------------------- */

function PreviewPanel({ bill }: { bill: DraftBill }) {
  const { perPerson, subtotal, adjustmentsTotal, grandTotal } =
    computeTotals(bill);
  const itemTotals = perPersonSubtotal(bill.items);

  return (
    <aside className="card p-5 lg:sticky lg:top-20">
      <h3 className="text-sm font-semibold tracking-tight mb-4 text-[color:var(--color-foreground-dim)] uppercase">
        Running total
      </h3>

      <div className="space-y-2 mb-5 text-sm">
        <Row label="Items subtotal" value={fmt(subtotal)} />
        {adjustmentsTotal !== 0 && (
          <Row
            label="Adjustments"
            value={`${adjustmentsTotal >= 0 ? "+" : "−"}${fmt(Math.abs(adjustmentsTotal))}`}
          />
        )}
        <div className="border-t border-[color:var(--color-border)] my-2" />
        <Row label="Total" value={fmt(grandTotal)} bold />
      </div>

      {bill.people.length > 0 && (
        <>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-muted)] mb-2">
            Per person
          </h4>
          <div className="space-y-1.5">
            {bill.people.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between text-sm gap-3"
              >
                <span className="truncate text-[color:var(--color-foreground-dim)]">
                  {p.name || "—"}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {itemTotals[p.id] !== undefined &&
                    adjustmentsTotal !== 0 && (
                      <span className="text-xs text-[color:var(--color-muted)] tabular-nums">
                        {fmt(itemTotals[p.id] || 0)}→
                      </span>
                    )}
                  <span className="tabular-nums font-medium">
                    {fmt(perPerson[p.id] || 0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {bill.items.length === 0 && (
        <p className="text-xs text-[color:var(--color-muted)] mt-4">
          Add items to see each person&apos;s share here.
        </p>
      )}
    </aside>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between ${
        bold ? "text-base" : ""
      }`}
    >
      <span className="text-[color:var(--color-foreground-dim)]">{label}</span>
      <span className={`tabular-nums ${bold ? "font-semibold" : ""}`}>
        {value}
      </span>
    </div>
  );
}
