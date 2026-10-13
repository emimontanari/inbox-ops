import { summarizeReviews } from "../../../src/domain/review-stats.js";
import type { Ticket } from "../../../src/domain/ticket.js";

// The business metric of the inbox: how often people keep the model's suggestion.
export function ReviewStats(props: { tickets: readonly Ticket[] }) {
  const stats = summarizeReviews(props.tickets);
  const rate = stats.acceptanceRate === null ? "—" : `${Math.round(stats.acceptanceRate * 100)}%`;

  const items: Array<[label: string, value: string, hint?: string]> = [
    ["Acceptance rate", rate, "Accepted out of accepted + corrected; manual triage is not counted"],
    ["Suggestions accepted", String(stats.decisions.accepted)],
    ["Suggestions corrected", String(stats.decisions.corrected), `${stats.categoryChanges} changed the category`],
    ["Triaged manually", String(stats.decisions.manual), "The model had failed"],
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map(([label, value, hint]) => (
        <div key={label} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm" title={hint}>
          <dt className="text-xs text-slate-500">{label}</dt>
          <dd className="text-xl font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
