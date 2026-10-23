# Legacy photo recovery

The database still references `/__l5e/assets-v1/...` for 596 products (461 visible at review time). The repository contained asset metadata JSON files rather than the corresponding image bytes. Lovable's Vite helper proxies these paths only in development; Hostinger's production server therefore returned HTTP 404.

A sample original image was recovered from the project's existing preview asset server and verified against its original size. The recovery manifest enumerates all 1210 distinct affected URLs, including main/gallery images and thumbnails. The isolated recovery workflow downloads them from that one fixed origin, validates file signatures, size limits and known original sizes, and records SHA-256 hashes in the recovery report. It commits only validated, complete results on the recovery branch.

The recovered files live under `public/__l5e/assets-v1` with their original paths. Production serves them from Hostinger; normal builds do not contact Lovable or require its credentials. No product, price, inventory, visibility or database URL changes are needed. The recovery workflow is separate from normal deployments and does not call a Lovable agent.
