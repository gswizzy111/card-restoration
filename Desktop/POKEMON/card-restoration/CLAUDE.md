@AGENTS.md

## Deploying

Production (thecarddoc1.com, Netlify site "thecarddoc") is built by Netlify
from GitHub `main`: merge to `main` to deploy. Never run `netlify deploy
--prod` from a local folder. It replaces the live site with whatever that
folder holds, including the live Stripe webhook that processes payments for
both this site and theonethatsaveditall.com. On October 23, 2026 a deploy
from an out-of-date local copy put the pre-Terms-v1.0 site back live; it was
fixed by deploying `main` again. Pull from GitHub before working locally.

## Dashboard numbers

The admin dashboard, Backlog tab (`/admin/backlog`) and Prep vs Restoration tab
(`/admin/services`) read their numbers from database functions
(`supabase/migrations/20261023_dashboard_metrics.sql`, through
`lib/dashboard-metrics.ts`), in New York days. Never bucket money or cards in
the browser or from unpaged selects: the API returns at most 1,000 rows (page
with `lib/fetch-all.ts`). Refunds come from the `refunds` ledger, dated when the
money went back (`lib/refund-ledger.ts`); a partial refund keeps
`payment_status` 'paid'. Triggers log order status changes and card ticks in
`backlog_events`; the daily job that saves backlog days and syncs refunds runs
from the other site (New-Website-Concept `netlify/functions/`).
