# Article and photo review

Open **Productos → Revisar artículos y fotos**, or the shortcut in **Alertas del negocio**. The existing Productos permission controls access and editing. No additional employee module is introduced.

The review reads a minimal product field list in ranged requests, including inactive articles allowed by RLS. It runs only when the review is opened; the public catalog keeps its 24-row server pagination. Filters cover brand, description/name or code, visibility, missing main photo, failed photo, unchecked photos, missing code, zero price and zero stock. Zero values are review notices: the tool never changes visibility, prices or balances automatically.

**Comprobar fotos de esta página** checks up to 25 displayed articles, including their thumbnail and gallery URLs. A maximum of three images load concurrently. Each image has an eight-second timeout; failures get a second attempt. Requests are browser image loads, without a server URL-fetch endpoint, CORS fetch or background job. **Detener comprobación** cancels remaining probes without recording a failed result for cancellation. **Recomprobar fotos** retries one article. Results are held in the current admin browser cache, scoped to the signed-in user, and expire after 30 minutes; they are not a permanent database report or shared across devices. “No responde” is a review finding, not proof that an image has been deleted: network/provider restrictions can also cause it.

**Editar artículo** fetches that exact ID and opens the existing form, including hidden/off-page products. Upload replacements in Imágenes, remove the old image or use **Usar como principal**, and save. The uploader retains WebP conversion and a smaller thumbnail. The article code field preserves leading zeroes. Updates require the expected `updated_at` version, so another employee's change cannot silently be overwritten by an older form. Saving refreshes the review, alerts, product list and public catalog cache. Photo checks are keyed by URL; a repaired URL can be checked again explicitly.

Public product cards retry the main full-size photo when the thumbnail fails. Product detail, gallery, cart and admin previews show a branded “Imagen no disponible” placeholder after their available sources fail. This never hides an article or changes checkout eligibility.

Validation uses synthetic browser fixtures and mocked Storage/database writes; no real products, inventory, payments or emails are modified by tests.
