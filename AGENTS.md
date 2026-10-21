<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the principal homepage slider in a focused component using the installed Embla engine, so touch gestures, click suppression after dragging, and responsive slide positioning use proven carousel logic.
- Guest order reads require an order-scoped HMAC capability verified server-side before privileged access, so knowing an order UUID does not expose customer data.
- Mercado Pago notifications require its webhook signature and provider-side payment, amount, currency and preference verification; return failures for retry instead of approving demo orders.
- Payment return pages share OrderConfirmation and expose click-to-chat only after verified payment; opening WhatsApp is not delivery proof and must not set whatsapp_sent.
- Prepare external catalog imports through scripts/catalog-import.ts with validated prices, explicit discount/rounding options and stored asset URLs before database insertion; preserve differently named source variants as separate product rows, so imported prices and presentations remain unambiguous.
- Classification is Category → Brand (subcategories) → Product type (product_types), each level its own table with composite FKs on products, so admin edits cannot assign mismatched classifications.
- Populate the header menu from managed categories and keep catalog filters in validated URL search parameters, so menu links, searches and browser history apply the same selection.
- Product Excel updates identify existing rows by immutable ID and change only name, description, article code, price, absolute stock balance and visibility through an admin-checked SECURITY INVOKER atomic database function; export reads all pages including inactive products so bulk editing cannot silently omit inventory or partially save an invalid file.
- App MCP uses SDK-generated transport routes and managed OAuth with a caller-scoped database factory; only active catalog reads are exposed, preserving RLS and excluding orders, payments and credentials.
- Browser-local catalog tools use useWebMCP in the catalog screen and share visible actions; static-name telemetry is fail-open and never records inputs or catalog content.
- Validate OAuth return paths once at sign-in and preserve the canonical path across sign-in and sign-up, so delegated consent is completed without open redirects.
- Catalog cards prefer products.thumbnail_url (small WebP) and fall back to image_urls[0]; admin uploads convert to WebP and store a thumbnail, so mobile listings stay light.
- Read full product tables through collectPages (src/lib/catalog-products.ts) or equivalent ranged loops for catalog and Excel operations, because the backend caps each request at 1000 rows; the admin list instead fetches only its current page with an exact total and stable created_at/id ordering to keep initial loading light.
- Render branch maps through lazy Google Maps Embed iframes using the managed browser key only on credential-free authorized origins, so footer maps stay lightweight and preview host access keys are not leaked through referrers.
- Price policies use an admin-checked SECURITY INVOKER RPC with explicit product IDs, row locks and expected updated_at versions; preview selection is paginated and whole-result selection uses collectPages, so confirmed batches are atomic and stale prices cannot silently overwrite concurrent edits.
- Admin product search goes through src/lib/admin-product-search.ts, which sanitizes the term and applies one quoted PostgREST or() filter across name, slug and description, so a stray wildcard, quote or comma cannot break the list; keep filtering server-side so the total, the page count and the rows always describe the same selection.

- Orders use immutable payment-attempt snapshots and 30-minute reservations through reserve_order_checkout; all reservation/payment/admin inventory transitions share a transaction advisory lock and stable product row locks. Never decrement stock directly in the webhook or compare an old payment only with the latest order total. Verified late payments are recorded and flagged when stock is unavailable; repeated approvals must never decrement twice.
- Retrying an unpaid checkout reuses its immutable order ID, verifies prior Mercado Pago payments and preserves the guest HMAC capability. Unpaid orders queue one recovery email after one hour; definitive abandonment occurs only 24 hours after the email provider accepts that reminder; archive preserves history and does not delete personal data. Scheduled reconciliation uses a dedicated private database credential, never a public cron endpoint or a service key in browser code.

- Recovery emails use a unique per-order outbox, a worker lease, immutable provider payloads and a stable Resend idempotency key. Verify Mercado Pago before each send and recheck order eligibility immediately before contacting the email provider. Do not retry an ambiguous send after the provider deduplication window; hold for review. Never start the final abandonment timer merely because an email was queued or attempted, and never expose the outbox payload containing guest order capabilities to browser queries.

- Homepage slides come from public.home_slides in sort_order/id order; only active rows are public. Keep the original built-in asset mappings for migrated slides. Slider uploads use the public slider-images bucket with admin-only writes and WebP conversion. Admin save/reorder/delete RPCs are SECURITY INVOKER, verify the admin role, and require expected updated_at versions to avoid silently overwriting concurrent edits.

- Admin sales analytics use the SECURITY INVOKER admin_sales_statistics RPC with RLS, matching approved payment attempts and payment IDs, Argentine calendar dates and one count per order including archived orders. Keep unverified historical paid statuses out of revenue; filtered totals exclude shipping, product rankings use order line prices, and stock alerts describe current balances without claiming historical availability.
