# Eonix Invoice

A responsive invoicing workspace built for GitHub Pages + Supabase.

## Included
- Supabase email/password authentication
- Business profile and currency settings
- Customer management
- Invoice creation, editing, deletion and status tracking
- Multiple line items and totals
- Dashboard metrics and simple reports
- CSV export
- Dark/light theme switcher
- Responsive desktop and mobile layout
- Supabase Row Level Security (RLS) schema

## Setup

1. Create a Supabase project.
2. Open **SQL Editor** and run `supabase/schema.sql`.
3. Open `assets/js/config.js`.
4. Replace `YOUR_SUPABASE_PROJECT_URL` and `YOUR_SUPABASE_ANON_KEY` with the Project URL and anon/public key from Supabase Project Settings → API.
5. Do not use the `service_role` key in browser code.
6. Upload the project files to a GitHub repository and enable GitHub Pages.
7. Open the published site and create an account.

## Important notes
- This is a functional starter release, not a fully audited production billing system.
- Invoice totals are calculated in the browser. For production, validate totals and permissions in a trusted database function or server-side endpoint.
- Email delivery, downloadable PDF invoices, public invoice links, online payment collection, tax rules, recurring invoices, team permissions and subscription checkout are not connected in this release.
- The plan prices shown in Settings are display information only. No subscription is activated or charged.
- Do not store card details or payment credentials in this app.
- Test RLS using separate Supabase users before using real customer data.

## Suggested next upgrades
1. Branded PDF invoice generation
2. Public invoice view with secure token
3. Payment gateway integration with verified server-side webhook
4. SST/tax and discount support
5. Recurring invoices and reminders
6. Staff roles and audit history
