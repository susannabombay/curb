// Receipts and monthly summaries built from booking history. Amounts are
// what Curb charged (hold fee + any paid extensions) -- the mall's own
// parking charges are paid at the gantry and aren't part of this.

export function receiptNumber(entry) {
  const d = new Date(entry.finishedAt);
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const tail = (entry.id || String(d.getTime())).replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
  return `CURB-${stamp}-${tail}`;
}

export function monthKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString([], { month: "long", year: "numeric" });
}

// [{ key, label, entries, totalCents, counts: { arrived, cancelled, expired } }], newest first.
export function monthlySummaries(history) {
  const byMonth = new Map();
  for (const h of history) {
    const key = monthKey(h.finishedAt);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key).push(h);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([key, entries]) => ({
      key,
      label: monthLabel(key),
      entries,
      totalCents: entries.reduce((s, e) => s + (e.fee_cents || 0), 0),
      counts: {
        arrived: entries.filter((e) => e.finalStatus === "arrived").length,
        cancelled: entries.filter((e) => e.finalStatus === "cancelled").length,
        expired: entries.filter((e) => e.finalStatus === "expired").length,
      },
    }));
}

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Triggers a CSV download of one month's bookings -- the format an expense
// system or spreadsheet will take directly.
export function downloadMonthCsv(summary) {
  const rows = [
    ["Receipt", "Date", "Carpark", "Car plate", "Arrival", "Status", "Amount (SGD)"],
    ...summary.entries.map((e) => [
      receiptNumber(e),
      new Date(e.finishedAt).toLocaleDateString("en-SG"),
      e.carpark_name,
      e.plate,
      e.arriveTime,
      { arrived: "Completed", cancelled: "Cancelled", expired: "No-show" }[e.finalStatus] || e.finalStatus,
      ((e.fee_cents || 0) / 100).toFixed(2),
    ]),
    ["", "", "", "", "", "Total", (summary.totalCents / 100).toFixed(2)],
  ];
  const blob = new Blob([rows.map((r) => r.map(csvCell).join(",")).join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `curb-receipts-${summary.key}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
