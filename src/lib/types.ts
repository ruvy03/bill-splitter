/**
 * Types used by the client-side bill wizard. These mirror the DB models but
 * use client-local ids (so we can add/remove items before persisting).
 */

export type DraftPerson = {
  id: string;
  name: string;
};

export type SplitMode = "even" | "percent" | "amount";

/** A single person's share of a single item, as the user is configuring it. */
export type DraftShare = {
  personId: string;
  /** In "even" mode this is derived (ignored); in other modes it's the input. */
  value: number;
  /** Whether this person is included in the split at all. */
  included: boolean;
};

export type DraftItem = {
  id: string;
  name: string;
  price: number;
  splitMode: SplitMode;
  shares: DraftShare[];
};

export type AdjustmentType = "tax" | "fee" | "discount";
export type AdjustmentSplit = "proportional" | "even";

export type DraftAdjustment = {
  id: string;
  name: string;
  amount: number;
  type: AdjustmentType;
  splitMode: AdjustmentSplit;
};

export type DraftBill = {
  title: string;
  date: string; // ISO yyyy-mm-dd for the <input type="date">
  people: DraftPerson[];
  items: DraftItem[];
  adjustments: DraftAdjustment[];
};

/** Shape we load from the DB for the detail page. */
export type SavedBill = {
  id: string;
  title: string;
  date: Date;
  createdAt: Date;
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
