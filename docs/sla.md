# Internal review SLA

The inbox prioritizes requests by the nearest review deadline. This is an internal, fictional target for **human triage review**, not a promise to send a customer response. InboxOps never sends replies.

## Use it

1. Import CSV with `body`, optional `id` and `receivedAt` (ISO with timezone, e.g. `2026-10-13T08:00:00-03:00`). Without a date, the clock starts at import.
2. Use **Vencimiento más cercano** (default order) or **Pendientes urgentes** to prioritize. Reviewed tickets are excluded from urgent filters and appear after pending requests in deadline order.
3. Review the ticket. Its clock stops at `reviewedAt`; it shows whether the review met the target. **Siguiente por revisar** picks the awaiting-review ticket with the nearest deadline across the whole inbox, regardless of list filters.

## Rules

| Category | Target (elapsed hours) |
| --- | --- |
| Billing | 4 h |
| Shipping | 8 h |
| Returns / other | 24 h |
| New / failed without classification | 24 h, provisional |

- **A tiempo:** at least 25% of the target remains.
- **Por vencer:** less than 25% remains, but the deadline has not passed.
- **Vencido:** the deadline has been reached or passed.
- Classification may change the target; reviewed tickets use the human final category.
- Ties use receipt time, then ID. The list clock refreshes every 30 seconds and on window focus, without provider calls.
- Invalid or future receipt dates are rejected per row. Historical tickets keep their stored import timestamps; no migration invents earlier receipt dates.

Targets live in `src/domain/sla.ts`. Deadlines and status are derived, not stored. No business calendar, external alerts, customer priority scoring or automatic actions are included. Displayed dates use the browser's timezone; elapsed hours are independent of timezone and daylight-saving changes.
