/**
 * Parse a pasted Instacart order-receipt block into a list of items.
 *
 * The receipts we've seen come in two shapes (Costco vs ALDI), but they
 * share a single reliable anchor: every item ends with a "Final item price:"
 * label followed by a `$X.YY` amount (either after the label on the same
 * line or on the next non-empty line). Section headers (e.g. "Produce"),
 * category counts, and the totals block at the end are ignored.
 *
 * We deliberately keep this permissive — future Instacart layouts should
 * still work as long as the "Final item price:" convention holds.
 *
 * Returns the items in the order they appear in the receipt. Only name +
 * price are extracted; splits/adjustments are the user's job.
 */
export function parseInstacartReceipt(
  text: string,
): { name: string; price: number }[] {
  const lines = text.split(/\r?\n/);
  const anchors: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/final\s*item\s*price\s*:/i.test(lines[i])) anchors.push(i);
  }

  const items: { name: string; price: number }[] = [];
  let prevAnchor = -1;

  for (const anchor of anchors) {
    const price = findPrice(lines, anchor);
    if (price === null) {
      prevAnchor = anchor;
      continue;
    }
    const name = findName(lines, prevAnchor, anchor);
    if (name) items.push({ name, price });
    prevAnchor = anchor;
  }

  return items;
}

function findPrice(lines: string[], anchor: number): number | null {
  const line = lines[anchor];
  const idx = line.toLowerCase().indexOf("final item price:");
  const after = idx >= 0 ? line.slice(idx + "final item price:".length) : "";
  const inline = after.match(/\$\s*(\d+(?:\.\d{1,2})?)/);
  if (inline) return parseFloat(inline[1]);
  // Look ahead a few lines for a standalone price line
  for (let j = anchor + 1; j < Math.min(anchor + 4, lines.length); j++) {
    const m = lines[j].match(/^\s*\$\s*(\d+(?:\.\d{1,2})?)\s*$/);
    if (m) return parseFloat(m[1]);
  }
  return null;
}

const IGNORE_PATTERNS: RegExp[] = [
  /^item\s+\d+/i, // Costco item number
  /^\d+\s*x\s*\$/i, // quantity × price line
  /loyalty\s+savings/i, // ✓ Loyalty savings: $X.XX
  /^✓/,
  /final\s*item\s*price/i,
  /^\$\s*\d/, // standalone price line
];

// Common Instacart section headers we should never mistake for a name.
const SECTION_HEADERS = new Set([
  "dairy & eggs",
  "deli",
  "produce",
  "bakery",
  "household",
  "frozen foods",
  "meat & seafood",
  "snacks, candy & nuts",
  "paper products & food storage",
  "beverages",
  "pantry",
  "personal care",
  "baby",
  "pets",
  "health & wellness",
  "canned goods & soups",
  "condiments & sauces",
  "breakfast",
  "international",
  "alcohol",
]);

function findName(lines: string[], lower: number, upper: number): string | null {
  // Walk backward from just before the anchor. Prefer indented lines
  // (item names are typically tab- or space-indented in Instacart emails).
  // Fall back to any non-metadata line if nothing indented is found.
  let indentedCandidate: string | null = null;
  let anyCandidate: string | null = null;

  for (let j = upper - 1; j > lower; j--) {
    const raw = lines[j];
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (IGNORE_PATTERNS.some((r) => r.test(trimmed))) continue;
    if (SECTION_HEADERS.has(trimmed.toLowerCase())) continue;
    // A category-count line like "6" or "Items found (Costco)" is noise too.
    if (/^\d+$/.test(trimmed)) continue;
    if (/^items?\s+found/i.test(trimmed)) continue;

    if (!anyCandidate) anyCandidate = trimmed;
    if (/^[\t ]/.test(raw)) {
      indentedCandidate = trimmed;
      break;
    }
  }

  return indentedCandidate ?? anyCandidate;
}
