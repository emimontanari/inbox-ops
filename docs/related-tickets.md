# Find related requests without inferring identity

Open a ticket and inspect **Solicitudes relacionadas** below its review panel. Other loaded tickets with the same current order number show their ID, status, category and received date, newest first.

## Navigate

1. Choose **Abrir solicitud …**. Matches use the whole loaded inbox, even if the destination is hidden by list filters.
2. Confirm the switch: local unsaved corrections and reply drafts are discarded. Cancel to keep the current screen unchanged.
3. Use **Volver a solicitud …** to return to the previous ticket. Filters remain unchanged, but discarded edits are not restored. This is a one-step return, not a persistent history.

Navigation is disabled while a review is saving. No API/provider calls are added. Saved reviews stay in the inbox; tickets are never merged.

## Matching rules

- Compare the extracted order number in the current classification, using the human final data for reviewed tickets (including manual triage).
- Trim outer whitespace only; keep case, punctuation and leading zeros. `004821` and `4821` are different identifiers.
- Exclude the selected ticket, blank identifiers and unclassified new/failed tickets. Never extract candidate numbers from raw message text.
- Sort by received date descending, then ID for stable ties.
- Recompute from loaded ticket data after a saved correction. An empty list means no matches in this loaded inbox, not no other customer contacts.

**A matching identifier is only a navigation hint.** Model-extracted identifiers can be wrong or injected; a shared number confirms neither a real order, identity, ownership nor intent. Read the messages before taking action.
