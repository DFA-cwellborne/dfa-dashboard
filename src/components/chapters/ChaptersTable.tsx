"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { Badge, statusToBadgeVariant } from "@/components/ui/Badge";
import type { ChapterRow } from "@/lib/types/database";

type SortKey = "name" | "state" | "member_count" | "status" | "school_type";

function SortHeader({
  label,
  sortableKey,
  activeKey,
  onSort,
}: {
  label: string;
  sortableKey: SortKey;
  activeKey: SortKey;
  onSort: (key: SortKey) => void;
}) {
  return (
    <button
      onClick={() => onSort(sortableKey)}
      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-navy/50 hover:text-navy"
    >
      {label}
      <ArrowUpDown size={12} className={activeKey === sortableKey ? "text-blue" : "text-navy/30"} />
    </button>
  );
}

export function ChaptersTable({ chapters }: { chapters: ChapterRow[] }) {
  const [schoolType, setSchoolType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [state, setState] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const states = useMemo(
    () => Array.from(new Set(chapters.map((c) => c.state).filter(Boolean))).sort() as string[],
    [chapters]
  );

  const filtered = useMemo(() => {
    let rows = chapters;
    if (schoolType !== "all") rows = rows.filter((c) => c.school_type === schoolType);
    if (status !== "all") rows = rows.filter((c) => c.status === status);
    if (state !== "all") rows = rows.filter((c) => c.state === state);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((c) => c.name.toLowerCase().includes(q));
    }
    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * sortDir;
      return String(av).localeCompare(String(bv)) * sortDir;
    });
  }, [chapters, schoolType, status, state, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search chapters…"
          className="w-56 rounded-lg border border-navy/15 bg-white px-3 py-2 text-sm text-navy placeholder:text-navy/30 focus:border-blue focus:outline-none"
        />
        <select
          value={schoolType}
          onChange={(e) => setSchoolType(e.target.value)}
          className="rounded-lg border border-navy/15 bg-white px-3 py-2 text-sm text-navy focus:border-blue focus:outline-none"
        >
          <option value="all">All School Types</option>
          <option value="HS">High School</option>
          <option value="College">College</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-navy/15 bg-white px-3 py-2 text-sm text-navy focus:border-blue focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="pending_launch">Pending Launch</option>
        </select>
        <select
          value={state}
          onChange={(e) => setState(e.target.value)}
          className="rounded-lg border border-navy/15 bg-white px-3 py-2 text-sm text-navy focus:border-blue focus:outline-none"
        >
          <option value="all">All States</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span className="ml-auto text-xs text-navy/40">{filtered.length} chapters</span>
      </div>

      <div className="dfa-scrollbar overflow-x-auto rounded-2xl border border-navy/10 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-navy/10 bg-navy/[0.02]">
              <th className="px-4 py-3 text-left">
                <SortHeader label="Chapter" sortableKey="name" activeKey={sortKey} onSort={toggleSort} />
              </th>
              <th className="px-4 py-3 text-left">
                <SortHeader label="Type" sortableKey="school_type" activeKey={sortKey} onSort={toggleSort} />
              </th>
              <th className="px-4 py-3 text-left">
                <SortHeader label="State" sortableKey="state" activeKey={sortKey} onSort={toggleSort} />
              </th>
              <th className="px-4 py-3 text-left">
                <SortHeader label="Status" sortableKey="status" activeKey={sortKey} onSort={toggleSort} />
              </th>
              <th className="px-4 py-3 text-right">
                <SortHeader label="Members" sortableKey="member_count" activeKey={sortKey} onSort={toggleSort} />
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.external_id} className="border-b border-navy/5 last:border-0 hover:bg-blue/[0.03]">
                <td className="px-4 py-3 font-medium text-navy">{c.name}</td>
                <td className="px-4 py-3 text-navy/70">{c.school_type ?? "—"}</td>
                <td className="px-4 py-3 text-navy/70">{c.state ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge variant={statusToBadgeVariant(c.status)}>{c.status ?? "unknown"}</Badge>
                </td>
                <td className="px-4 py-3 text-right text-navy/70">
                  {c.member_count !== null ? c.member_count.toLocaleString() : "No data"}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-navy/40">
                  No chapters match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
