# Monthly Budget with on-demand carry-forward materialization

Budget was a single flat row per `(Category, Family)` applying to every month indefinitely (issue #51). We changed it to one row per `(Category, Family, Month, Year)`, since Members want to set a different cap per month rather than one standing amount.

Rather than a scheduled job that sweeps every Family monthly to pre-create the new month's rows, materialization happens **on-demand**: the first time a Member opens the Budget screen for a month that has no row for a Category, the backend copies the amount from that Category's most recent *existing* Budget row (whatever month it's from — no recursive backfill of skipped months) and writes a new row for the requested month. This avoids a cron job whose cost scales with total Families regardless of activity, at the cost of a slightly heavier first request per Family per month.

Deleting a month's Budget row is a plain delete, not a tombstone — the next month's carry-forward will simply reach past the deleted row to whichever real row precedes it. We accepted that a deleted amount can "come back" next month as a simpler alternative to tracking explicit "no budget" state.

Existing pre-migration Budget rows (no month/year) are stamped with the current month/year at deploy time via a migration patch, rather than backdated — this preserves today's behavior exactly on upgrade day, and months before the deploy simply show no Budget (history isn't rewritten).
