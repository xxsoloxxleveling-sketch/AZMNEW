# Examination Halls

CLASSIC CLIENT-APPROVED UI PROFILE

Visual reference: 7578b2dd. Reuse compact white/slate panels, restrained rounded-xl containers, subtle borders/shadows, blue action buttons, and classic modal proportions. Keep the global MASTER unchanged.

The workspace uses a compact module header, five real summaries, a center selector, Hall tiles, and a selected Hall detail with an operational table. Center labels show actual name, code, and Hall count. Tiles show room, target class, capacity, explicit assignments, available seats, and textual capacity status.

The roster shows backend Seat, Candidate, Roll Number, Application ID, Class, Room, and direct actions. Tables scroll internally at narrow widths. No private identity, contact, document, financial, or fee data is shown.

Placement uses the protected paginated candidate endpoint with search, canonical class aliases, assignment filters, and multi-selection. Move, seat change, unassign, create/edit, and empty-Hall deletion use labeled dialogs, inline errors, focus containment/restoration, and Escape dismissal. Backend conflicts remain authoritative; success uses the returned assigned count.

Empty APIs show truthful center/Hall empty states. Failed APIs show errors and Retry rather than empty results. Refresh preserves page structure. Available seats are max(capacity - assignedCount, 0); invalid capacity is unknown. Full and over-capacity states use text and color.

Membership comes only from assignedHallId. Legacy text-only allocation is flagged for review without automatic attachment. Seats come only from stored seatNo; missing seats read Unassigned. Printable A4 rosters contain explicitly assigned candidates, actual metadata, and signature columns, with dynamic HTML escaped. No attendance or fee status and no generated row-index seats.

Invigilator fields remain free text and are labeled Recorded Invigilator. Schedule fields start blank and inherit only real selected-center values. Hall routing stays deferred until Step 12C.
