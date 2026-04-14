# V3 Changelog — Backend (XYZ-media-backend-v3)

All entries in chronological order. Source folder: `XYZ-media-backend-main/` (untouched).

## 2026-04-10 — Initial v3 fork

### New Files
- `CHANGELOG_V3.md` — this file. Tracks every change made in v3 vs the original.

---

## 2026-04-10 — Priority 1: 3-Layer Fee System foundation

### New Files
- `src/api/global-setting/content-types/global-setting/schema.json` — Single type holding default SonoSuite cut %, default platform fee %, minimum payout threshold, fast-release fee per track.
- `src/api/global-setting/controllers/global-setting.js` — default core controller.
- `src/api/global-setting/routes/global-setting.js` — default core router.
- `src/api/global-setting/services/global-setting.js` — default core service.

- `src/api/plan/content-types/plan/schema.json` — Collection type for subscription plans (Starter, Professional, Free, Enterprise).
- `src/api/plan/controllers/plan.js` — default core controller.
- `src/api/plan/routes/plan.js` — default core router.
- `src/api/plan/services/plan.js` — default core service.

### Modified Files
- `src/extensions/users-permissions/content-types/user/schema.json`
  - **Before:** Existing fields incl. firstName, lastName, phoneNumber, currency, dob, user_type, plus relations to drafts/artists/notifications/invoices/fee histories.
  - **After:** Added `platformFeeOverride` (decimal nullable), `commissionOverride` (decimal nullable), `availableBalance` (decimal default 0), `pendingBalance` (decimal default 0), `paymentMethod` (json), `subscriptionStatus` (enum: active/expired/cancelled), `subscriptionStartDate` (date), `subscriptionEndDate` (date), `plan` (manyToOne → api::plan.plan), and `payout_requests` (oneToMany → api::payout-request.payout-request).
  - **Why:** Required by 3-layer fee system, payout system, and plan enforcement (Priorities 1, 3, 10).

- `src/api/royalty-report/content-types/royalty-report/schema.json`
  - **Before:** Stored only the post-commission `NetTotal`.
  - **After:** Added `SonosuiteCutApplied` (decimal), `PlatformFeeApplied` (decimal), `CommissionApplied` (decimal), `ArtistEarnings` (decimal).
  - **Why:** Each royalty row must persist all three layered fee % applied so they can be audited and shown in reports.

- `src/api/royalty-report/services/royalty-report.js`
  - **Before:** `importCSV(filepath, filename, commissionPercent=15)` applied a single commission % per ISRC group.
  - **After:** New signature `importCSV(filepath, filename, options)` where `options` supports `{ sonosuiteCutPercent, dspOverrides, commissionPercent }`. Applies SonoSuite cut → platform fee → commission in three layers, with per-DSP overrides for the SonoSuite cut, per-user overrides for platform fee and commission, and falls back to `global-setting` defaults. Persists each applied % on every royalty-report row, updates `users_permissions_user.availableBalance` with the final ArtistEarnings, and feeds the new layered totals into `generateInvoices`.
  - **Why:** Implements Priority 1 — 3-layer fee system with hidden SonoSuite cut and DSP overrides; also seeds Priority 3 (payouts) with running balances.

### Database Changes
- New content type: `global-setting` (single type) — `defaultSonosuiteCut`, `defaultPlatformFee`, `minimumPayoutThreshold`, `fastReleaseFeePerTrack`.
- New content type: `plan` (collection) — `name`, `slug`, `price`, `billingCycle`, `maxPrimaryArtists`, `defaultCommission`, `isContactSales`, `isActive`, `sortOrder`.
- Extended user schema — see Modified Files above.
- Extended royalty-report schema — see Modified Files above.

---

## 2026-04-10 — Priority 3: Payout System (backend)

### New Files
- `src/api/payout-request/content-types/payout-request/schema.json` — Collection type with status workflow, reviewer, payment method snapshot, transaction reference.
- `src/api/payout-request/controllers/payout-request.js` — Custom controller exposing `create`, `approve`, `complete`, `reject`. Validates balance vs. minimum threshold, debits/credits user balances, writes notifications.
- `src/api/payout-request/routes/payout-request.js` — Default core router.
- `src/api/payout-request/routes/custom-payout-request.js` — Custom routes for `approve`, `complete`, `reject`.
- `src/api/payout-request/services/payout-request.js` — Default core service.

### Database Changes
- New content type: `payout-request` (collection) — see schema for fields.

---

## 2026-04-10 — Priority 4: SonoSuite CSV Export (backend)

### New Files
- `src/api/publish-distribute/routes/sonosuite-export.js` — Custom route `POST /publish-distributes/export-sonosuite`.
- `src/api/publish-distribute/controllers/sonosuite-export.js` — Generates SonoSuite-format CSV: builds `#metadata` header, then a `#release_info,...,#track_info` section with one row per track with all release fields repeated. Admin-gated. Streams the result with the correct `Content-Disposition` so the frontend can save it.
  - Helpers: `csvEscape` (quote-safe), `fmtDate`, `formatParticipants` (handles both array + object RoleCredits shapes).

---

## 2026-04-10 — Priority 5: Enhanced Support Tickets (backend)

### New Files
- `src/api/ticket-message/content-types/ticket-message/schema.json` — Conversation entry attached to a ticket. Fields: `ticket` (manyToOne), `sender` (oneToOne user), `message` (text required), `attachments` (media multiple), `isInternal` (boolean default false). Draft/publish enabled.
- `src/api/ticket-message/controllers/ticket-message.js` — Custom controller. `find` strips `isInternal` notes from non-admin callers and filters by `?filters[ticket][id][$eq]=`. `create` forces `sender = ctx.state.user.id`, denies `isInternal` to non-admins, enforces ownership (regular users can only post on their own ticket), and auto-bumps the parent ticket from `waiting_on_customer` → `in_progress` when the artist replies.
- `src/api/ticket-message/routes/ticket-message.js` — default core router.
- `src/api/ticket-message/services/ticket-message.js` — default core service.
- `src/api/ticket-raise/content-types/ticket-raise/lifecycles.js` — `beforeCreate` computes `slaDeadline` from priority (urgent=4h, high=24h, medium=48h, low=72h). `beforeUpdate` recomputes on priority change and stamps `closedAt` when status moves to `closed` / `resolved`.

### Modified Files
- `src/api/ticket-raise/content-types/ticket-raise/schema.json`
  - **Before:** title/description/status (open/in-progress/closed)/is_read/user/attachment.
  - **After:** Kept the legacy `in-progress` enum value alongside new `in_progress` and `waiting_on_customer` to avoid invalidating existing rows. Added `category` enum (billing/release_issue/payout/general/account), `priority` enum (low/medium/high/urgent), `assignedTo` (oneToOne admin user), `slaDeadline` (datetime — set by lifecycle), `closedAt` (datetime — set by lifecycle), and `messages` (oneToMany → ticket-message).
  - **Why:** Implements Priority 5 — categories, priorities, SLA tracking, and threaded conversations.

### Database Changes
- New content type: `ticket-message` (collection).
- Extended `ticket-raise` schema — see above.

---

## 2026-04-10 — Priority 6: Impersonation mode (backend)

### New Files
- `src/api/admin-impersonate/routes/admin-impersonate.js` — `POST /admin/impersonate/:userId` (admin-only).
- `src/api/admin-impersonate/controllers/admin-impersonate.js` — Validates that the caller is an admin, refuses to impersonate other admins, then issues a 1-hour JWT for the target user via `users-permissions.services.jwt.issue` with an `impersonatedBy` claim so future audit middleware can attribute actions back to the original admin.

---

## 2026-04-10 — Priority 7: Audit log (backend)

### New Files
- `src/api/audit-log/content-types/audit-log/schema.json` — Append-only collection: `actor`, `actorEmail`, `impersonatedUserId`, `action`, `method`, `path`, `targetType`, `targetId`, `statusCode`, `ipAddress`, `userAgent`, `metadata` (json). Draft/publish disabled.
- `src/api/audit-log/services/audit-log.js` — Adds a `record(entry)` helper that swallows write errors so audit logging can never break the originating request.
- `src/api/audit-log/controllers/audit-log.js` — Admin-only `find` with filters (`actorId`, `action`, `targetType`, `from`, `to`) and pagination.
- `src/api/audit-log/routes/audit-log.js` — Only exposes `GET /audit-logs`. Writes happen exclusively from the global middleware so callers can't forge entries.
- `src/middlewares/audit-log.js` — Global middleware that records every successful mutating (`POST/PUT/PATCH/DELETE`) admin or impersonated request, deriving `targetType`/`targetId` from the URL when possible. Skips `/api/auth`, `/api/audit-logs`, `/api/upload`.

### Modified Files
- `config/middlewares.js`
  - **Added:** `'global::audit-log'` at the end of the middleware chain.

---

## 2026-04-10 — Priority 8: Bulk admin actions (backend)

### New Files
- `src/api/admin-bulk/routes/admin-bulk.js` — `POST /admin/bulk-update-users` and `POST /admin/bulk-update-releases`.
- `src/api/admin-bulk/controllers/admin-bulk.js` — Admin-only. Each handler accepts `{ ids, action, payload }`, processes records sequentially so a single bad row only fails its own update, and returns a per-id success/error map. Supported user actions: `block`, `unblock`, `set-plan`. Supported release actions: `approve`, `reject`, `delete`.

---

## 2026-04-10 — Priority 9: Admin financial settings (backend)

### Modified Files
- `src/api/global-setting/controllers/global-setting.js`
  - **Before:** Default core controller — `find` would return null until the single type was first edited via Strapi admin.
  - **After:** Custom `find` always returns the row (auto-created via the existing `getOrCreate()` service helper). Custom `update` enforces an admin role check before persisting via `entityService.update`. The default router still exposes `GET /global-setting` and `PUT /global-setting`.

---

## 2026-04-10 — Priority 10: Plan enforcement (backend)

### New Files
- `src/api/artist-detail/content-types/artist-detail/lifecycles.js` — `beforeCreate` reads the owning user's plan and counts existing artists. If `plan.maxPrimaryArtists` is set and the count is at or above the limit, throws an error with the plan name and limit so the artist sees a meaningful "upgrade your plan" message. Legacy users without a plan are unaffected (treated as unlimited).
