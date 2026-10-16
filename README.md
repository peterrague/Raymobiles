# Batrobas

Web dashboard for phone distribution. Phones come from suppliers. Jill is the supplier, and each supplier lists the type of phone, model, and quantity supplied. The company sells in Mombasa and Nyandarua. Admins, sales leads, and sales agents share one set of books for stock, daily deposit prices, units sold, and the cash leads use to pay customer deposits.

The app is a Next.js project meant to run on Vercel, with Neon Postgres and Google sign-in.

## Roles

- **Admin** sees and edits every region: central stock, allocations, cash sent to each lead, users, and the audit log.
- **Sales lead** runs one region, records opening stock and the day’s deposit price, handles that region’s cash, and also records their own sales.
- **Sales agent** records only how many phones they sold, by supplier. Agents do not see cash, deposits, or balances.

Removing a lead or agent deactivates the account. Past sales, stock, and cash stay in the daily, weekly, and monthly reports. Every change to stock, prices, sales, cash, users, and roles is written to an audit log the admin can read and nobody can edit.

## Cash

Cash is working money for customer deposits, not sales income. The admin logs the amount sent to a lead. The lead records the amount received. The comparison shows whether those match; the lead’s figure is the one used in the books.

Starting cash is the balance brought forward plus cash received. The transaction is starting cash minus the closing balance, and that closing balance becomes the next day’s balance brought forward. On a region’s first day the lead enters the opening balance. After that it is carried forward.

Expected deposits are phones sold times that day’s deposit price. They are visible to the admin and the lead, not to agents.

## Setup

1. Create a Neon project and copy the pooled Postgres connection string.
2. In Google Cloud, create an OAuth web client. Add these redirect URIs:

   - `http://localhost:3000/api/auth/callback/google`
   - `https://<your-vercel-domain>/api/auth/callback/google`

3. Copy `.env.example` to `.env.local` and fill in `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and `ADMIN_EMAIL`.
4. Create the tables, Jill, and the two regions:

```bash
npm install
npm run db:push
npm run db:seed
```

5. Start the app with `npm run dev` and sign in with the Google account for `ADMIN_EMAIL`. That first sign-in creates the admin. After that, add leads and agents on the Team page using their Google email addresses before they sign in.

Generate `AUTH_SECRET` with `openssl rand -base64 32`.

## Vercel

Import the repository in Vercel. Set the same environment variables there, using the production Google redirect URI and the Neon pooled connection string. `AUTH_URL` can be the production URL. Push the schema to Neon before the first sign-in (`npm run db:push` from a machine that has `DATABASE_URL`), then redeploy if the first request ran before the tables existed.

## Scripts

- `npm run dev` — local app
- `npm test` — cash, stock, and reporting-period calculations
- `npm run db:push` — apply the Drizzle schema to Neon
- `npm run db:seed` — insert Jill, Mombasa, and Nyandarua if they are missing, and mark every other supplier inactive
- `npm run db:generate` — write a SQL migration from the schema

Amounts are whole Kenyan shillings. Business dates use Africa/Nairobi.
# Raymobiles
# Raymobiles
