# 570 Church Softball League

Production-ready Next.js + Supabase + Twilio app for a church softball league.

## Features
- Public pages: Home, Schedule, Standings, Teams/Rosters, Rules.
- Admin pages: team/alias management, roster management, schedule builder, quick game score entry, rules editor, SMS allow-list, standings/tie overrides.
- Admin auth with multi-admin support.
- Admin invite by email from dashboard.
- Admin password change from dashboard.
- Result support for:
  - Win/Loss
  - Tie game
- Auto standings recalculation by win percentage, then head-to-head, then admin tie override.
- SMS reporting via Twilio from approved phone numbers only.

## Tech Stack
- Next.js App Router + TypeScript
- Supabase (Auth + Postgres + RLS)
- Twilio Messaging webhook
- Vercel deployment target

## Environment Variables
Copy `.env.example` to `.env` for local development:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ADMIN_INVITE_REDIRECT_URL=
TWILIO_AUTH_TOKEN=
TWILIO_WEBHOOK_URL=
TWILIO_PHONE_NUMBER=
```

Notes:
- `SUPABASE_SERVICE_ROLE_KEY` and `TWILIO_AUTH_TOKEN` are secrets. Never commit them.
- `TWILIO_WEBHOOK_URL` should be your deployed endpoint, e.g. `https://<domain>/api/twilio/inbound`.
- `ADMIN_INVITE_REDIRECT_URL` is optional. If empty, app uses `NEXT_PUBLIC_SITE_URL/admin/login`.

## Database Migrations
Migrations live in `supabase/migrations`:
- `20260213180000_league_schema.sql`
- `20260214131500_add_player_role.sql`
- `20260214153500_add_tie_game_support.sql`

The schema uses `league` and includes tables for admins, teams, aliases, players, rules, games, allowed SMS numbers, tie overrides, and audit logs.

## Admin Bootstrap
Bootstrap is only needed once when there are no admin rows yet:
1. Sign in at `/admin/login`.
2. Click **Bootstrap First Admin**.

After that, use **Admin Dashboard -> Admin Access** to add or invite other admins.

## SMS Formats
Supported win/loss formats:
- `MM/DD G1 Saint Johns W Calvary Bible L`
- `MM/DD/YYYY G2 St John W Cal Bible L`

Supported tie formats:
- `MM/DD G1 Saint Johns T Calvary Bible T`
- `MM/DD/YYYY G2 St John vs Cal Bible Tie game`

Rules:
- `MM/DD` uses current year in `America/New_York`.
- `G1` or `G2` is required.
- Team aliases are resolved from `league.team_aliases`.
- If alias resolution fails/ambiguous, no update is saved and Twilio replies with guidance.

## Deploy (Vercel + Supabase + Twilio)
1. Import repo into Vercel and deploy.
2. Set all env vars in Vercel (same keys as above).
3. In Supabase Auth URL settings:
   - Set Site URL to your production domain.
   - Add redirect URL for `/admin/login`.
4. In Twilio phone number config:
   - Set incoming SMS webhook to `POST https://<domain>/api/twilio/inbound`.
5. In app admin:
   - Add approved SMS sender numbers at `/admin/sms`.

## Local Development
```bash
npm install
npm run dev
```

## Quality Checks
```bash
npm run lint
npm test
npm run build
```
