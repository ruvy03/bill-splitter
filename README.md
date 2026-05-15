# Split — bill splitting app

A local-first bill splitting web app built with **Next.js 16**, **React 19**,
**Tailwind CSS v4**, **TypeScript**, and **Prisma + SQLite**.

Split any bill between any number of people, with per-item share configuration
(even / percent / custom dollar amounts), plus tax, fees, and discounts that
can each be split proportionally or evenly.

## Features

- 🧮 **Per-item shares** — check who's in on each item, then pick **even**,
  **percent**, or **custom dollar** splits. Custom amounts auto-reconcile to
  the item price so totals always add up.
- 🧾 **Tax, fees, discounts** — add as many as you like, each split either
  **proportionally** (by what each person spent) or **evenly**.
- 📊 **Visualizations** — pie charts for spending by person and by item, plus
  a full per-item breakdown table.
- 💾 **Local SQLite database** — zero setup, single file (`prisma/dev.db`).
- 📜 **Past bills homepage** — every saved bill is listed as a card with its
  date, total, and people.

## Getting started

### 1. Install dependencies

```bash
npm install
```

Prisma will auto-run `prisma generate` via the `postinstall` script, so the
Prisma client is ready to go.

### 2. Create the local database

```bash
npx prisma db push
```

This creates `prisma/dev.db` and applies the schema. You don't need to run
migrations — `db push` is the one-shot command for development.

### 3. Run the dev server

```bash
npm run dev
```

Open <http://localhost:3000>. Click **New bill** to create your first bill.

### Optional: browse the database

```bash
npm run db:studio
```

Opens Prisma Studio at <http://localhost:5555>.

## Project structure

```
src/
├── app/
│   ├── layout.tsx           Root layout, header
│   ├── page.tsx             Homepage (past bills grid)
│   ├── globals.css          Tailwind v4 + dark theme tokens
│   ├── new/page.tsx         4-step bill creation wizard
│   └── bills/[id]/page.tsx  Bill detail view
├── components/
│   ├── SplitCard.tsx        Per-person card (matches the screenshot)
│   ├── Charts.tsx           Recharts pie charts
│   └── DeleteBillButton.tsx Delete confirmation
├── lib/
│   ├── db.ts                Prisma client singleton
│   ├── types.ts             Draft vs saved type definitions
│   ├── calculations.ts      ⭐ All split & adjustment math
│   └── actions.ts           Server actions (create/list/get/delete)
prisma/
└── schema.prisma            Bill, Person, Item, ItemShare, Adjustment
```

## How the math works

All split logic lives in `src/lib/calculations.ts`:

- **`resolveItemShares(item)`** — given an item with a `splitMode` of
  `"even" | "percent" | "amount"`, returns a `{ personId -> dollars }` map
  that always sums exactly to the item price. Custom amounts are scaled
  proportionally if they don't already add up; percentages are normalized
  to 100%.
- **`distributeAdjustment(adj, people, itemTotals, itemSubtotal)`** —
  distributes a tax / fee / discount across people. Proportional mode uses
  each person's item subtotal as the weight; even mode divides equally.
  Discounts are treated as negative amounts.
- **`computeTotals(bill)`** — composes the above into a `{ perPerson,
  subtotal, adjustmentsTotal, grandTotal }` result that both the live preview
  (during creation) and the detail page use.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Run production build |
| `npm run db:push` | Sync schema → SQLite DB |
| `npm run db:studio` | Open Prisma Studio |

## Requirements

- Node.js 20 or later
- npm (or pnpm / yarn — adjust commands accordingly)

## Tech stack versions

- Next.js ^16.2
- React ^19
- Tailwind CSS ^4.2 (CSS-first config via `@theme` in `globals.css`)
- Prisma ^6.5 with SQLite
- Recharts ^2.15
- Lucide React ^0.453

## Troubleshooting

**"Module '@prisma/client' not found"** after the first install — run
`npx prisma generate` manually.

**Database file missing** — run `npx prisma db push` to create it.

**Want to reset everything** — delete `prisma/dev.db` and run
`npx prisma db push` again.
