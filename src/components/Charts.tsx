"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { fmt } from "@/lib/calculations";

// Pleasing palette that works on a dark background.
const PALETTE = [
  "#34d399", // emerald
  "#60a5fa", // blue
  "#f472b6", // pink
  "#fbbf24", // amber
  "#a78bfa", // violet
  "#fb7185", // rose
  "#22d3ee", // cyan
  "#facc15", // yellow
  "#fb923c", // orange
  "#4ade80", // green
];

type Slice = { name: string; value: number };

export function SpendingPieChart({
  data,
  title,
}: {
  data: Slice[];
  title: string;
}) {
  const filtered = data.filter((d) => Math.abs(d.value) > 0.004);
  if (filtered.length === 0) {
    return (
      <div className="card p-5">
        <h3 className="text-sm font-semibold tracking-tight mb-2">{title}</h3>
        <p className="text-xs text-[color:var(--color-muted)]">
          Nothing to chart.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold tracking-tight mb-3">{title}</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={filtered}
              dataKey="value"
              nameKey="name"
              innerRadius={40}
              outerRadius={75}
              paddingAngle={2}
              stroke="#161618"
              strokeWidth={2}
            >
              {filtered.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "#18181b",
                border: "1px solid #27272a",
                borderRadius: 8,
                fontSize: 12,
                color: "#fafafa",
              }}
              itemStyle={{ color: "#fafafa" }}
              labelStyle={{ color: "#fafafa" }}
              formatter={(v: number) => fmt(v)}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }}
              iconType="circle"
              iconSize={8}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
