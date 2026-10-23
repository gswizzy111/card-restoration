@AGENTS.md

## Deploying

Production (thecarddoc1.com, Netlify site "thecarddoc") is built by Netlify
from GitHub `main`: merge to `main` to deploy. Never run `netlify deploy
--prod` from a local folder. It replaces the live site with whatever that
folder holds, including the live Stripe webhook that processes payments for
both this site and theonethatsaveditall.com. On October 23, 2026 a deploy
from an out-of-date local copy put the pre-Terms-v1.0 site back live; it was
fixed by deploying `main` again. Pull from GitHub before working locally.
