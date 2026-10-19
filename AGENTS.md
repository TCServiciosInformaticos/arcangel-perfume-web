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
- Store subcategories separately under one category and enforce product/category membership in the database, so admin edits cannot assign mismatched classifications.
- Populate the header menu from managed categories and keep catalog filters in validated URL search parameters, so menu links, searches and browser history apply the same selection.
- Product Excel updates identify existing rows by immutable ID and change only price, absolute stock balance and visibility through an admin-checked SECURITY INVOKER atomic database function; export reads all pages including inactive products so bulk editing cannot silently omit inventory or partially save an invalid file.
