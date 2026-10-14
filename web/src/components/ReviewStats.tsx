import { summarizeReviews } from "../../../src/domain/review-stats.js";
import type { Ticket } from "../../../src/domain/ticket.js";

// The business metric of the inbox: how often people keep the model's suggestion.
export function ReviewStats(props: { tickets: readonly Ticket[] }) {
  const stats = summarizeReviews(props.tickets);
  const rate = stats.acceptanceRate === null ? "—" : `${Math.round(stats.acceptanceRate * 100)}%`;

  const items: Array<[label: string, value: string, hint?: string]> = [
    ["Tasa de aceptación", rate, "Aceptadas sobre aceptadas + corregidas; no cuenta la clasificación manual"],
    ["Sugerencias aceptadas", String(stats.decisions.accepted)],
    ["Sugerencias corregidas", String(stats.decisions.corrected), `${stats.categoryChanges} cambiaron la categoría`],
    ["Clasificadas manualmente", String(stats.decisions.manual), "El modelo había fallado"],
  ];

  return (
    <dl className="review-stats" aria-label="Resultados de revisión">
      {items.map(([label, value, hint]) => (
        <div key={label} className="stat-card" title={hint}>
          <dt className="text-xs text-slate-500">{label}</dt>
          <dd className="text-xl font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
