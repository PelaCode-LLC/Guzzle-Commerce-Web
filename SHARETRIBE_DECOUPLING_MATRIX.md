# Sharetribe Dependency Matrix and Decoupling Plan

Date: 2026-03-17

## Scope and status

This document maps remaining Sharetribe coupling in this codebase and proposes a phased migration plan.

Legend:
- Replace now: blocks full backend-only architecture or creates runtime risk.
- Defer: can remain temporarily behind existing mode toggles.
- Keep behind toggle: acceptable to keep if Sharetribe mode remains intentionally supported.

Effort scale:
- S: 0.5-1 day
- M: 2-4 days
- L: 1-2 weeks
- XL: 2-4 weeks

## Dependency matrix by area

| Area | Coupling type | Evidence | Recommendation | Effort |
|---|---|---|---|---|
| Build toolchain | Sharetribe scripts | package.json uses sharetribe-scripts for dev/build/test/eject | Replace now | M |
| Frontend SDK loader | Direct Sharetribe SDK import | src/util/sdkLoader.js imports sharetribe-flex-sdk | Replace now | M |
| Runtime mode toggle | Dual mode flag | src/config/settings.js uses REACT_APP_USE_SHARETRIBE_CONSOLE | Keep behind toggle (or remove in final cleanup) | S |
| Core auth in frontend | Partial SDK use paths still present | src/ducks/auth.duck.js, src/ducks/user.duck.js | Replace now for backend-only target | M |
| Listings in frontend | Many sdk.listings/ownListings usages still in non-migrated pages | src/containers/SearchPage/SearchPage.duck.js, src/containers/ProfilePage/ProfilePage.duck.js | Replace now | L |
| Listing detail/management | Mixed mode with backend fallback already added | src/containers/ListingPage/ListingPage.duck.js, src/containers/ManageListingsPage/ManageListingsPage.duck.js | Continue replacing now | M |
| Checkout/transactions | Heavy SDK transaction coupling | src/containers/CheckoutPage/CheckoutPage.duck.js, src/containers/TransactionPage/TransactionPage.duck.js, src/containers/MakeOfferPage/MakeOfferPage.duck.js | Replace now (highest product risk) | XL |
| Messaging/inbox | SDK messages/transactions | src/containers/InboxPage/InboxPage.duck.js, src/containers/TransactionPage/TransactionPage.duck.js | Replace now | L |
| Payments/Stripe connect pages | SDK Stripe resources | src/ducks/paymentMethods.duck.js, src/ducks/stripeConnectAccount.duck.js, src/containers/PaymentMethodsPage/PaymentMethodsPage.duck.js | Replace now if keeping payments | L |
| Hosted assets | SDK asset fetch in client/server | src/ducks/hostedAssets.duck.js, server/api-util/sdk.js, server/resources/* | Defer or replace with local config/DB asset store | M |
| Server SDK utility | Sharetribe SDK instance creation + token flows | server/api-util/sdk.js | Replace now for backend-only target | M |
| Privileged transaction APIs | Sharetribe transaction initiation/transition | server/api/initiate-privileged.js, server/api/transition-privileged.js, server/api/transaction-line-items.js | Replace now (critical) | XL |
| Server auth with IDP/login-as | Sharetribe-specific auth helpers | server/api/auth/createUserWithIdp.js, server/api/auth/loginWithIdp.js, server/api/initiate-login-as.js, server/api/login-as.js | Defer if not used, otherwise replace | M |
| SSR resource endpoints | Sitemap/robots/webmanifest via SDK | server/resources/sitemap.js, server/resources/robotsTxt.js, server/resources/webmanifest.js | Defer | M |
| Sharetribe env surface | Many SHARETRIBE env vars and checks | .env-template, server/index.js, server/csp.js | Replace now once migration complete | S |

## Prioritized action plan

### Phase 0: Safety and observability (quick)

1. Add a single architecture target flag and assert mode at startup.
2. Log when any Sharetribe path is invoked while backend-only mode is expected.
3. Add a CI grep guard that fails if new Sharetribe SDK imports are added outside an allowlist.

Exit criteria:
- You can detect accidental regressions immediately.

Estimated effort: S

### Phase 1: Build/runtime decoupling foundation

1. Replace sharetribe-scripts with explicit bundler/test scripts currently needed.
2. Isolate src/util/sdkLoader.js behind an adapter interface.
3. Keep only one entry point for mode checks and remove duplicated local checks where possible.

Exit criteria:
- App builds/tests without relying on Sharetribe toolchain assumptions.

Estimated effort: M

### Phase 2: Transaction and payment flows (highest value)

1. Replace SDK transaction lifecycle calls in:
   - CheckoutPage.duck
   - TransactionPage.duck
   - MakeOfferPage.duck
   - RequestQuotePage.duck
2. Implement equivalent backend endpoints and line-item logic currently expected by UI reducers/selectors.
3. Replace inbox/message endpoints used by transaction pages.
4. Replace payment method/Stripe account setup flows if payments are retained.

Exit criteria:
- User can complete quote/checkout/transaction/inbox/payment operations without any SDK call.

Estimated effort: XL

### Phase 3: Remaining listing/profile/search/account SDK calls

1. Replace search/profile listings fetches and related includes/image variant handling.
2. Replace profile/account update paths still using sdk.currentUser and password reset SDK flows.
3. Normalize response format to current entity expectations to avoid broad UI rewrites.

Exit criteria:
- Listing discovery, profile/account, and account management run purely through backend APIs.

Estimated effort: L

### Phase 4: Server-side Sharetribe feature cleanup

1. Remove or replace server Sharetribe APIs that are no longer needed:
   - initiate-privileged
   - transition-privileged
   - transaction-line-items
   - login-as and IDP helpers (if unused)
2. Replace sitemap/robots/webmanifest dependencies on SDK.
3. Remove SDK utility, cache proxy integration, and Sharetribe env variable requirements.

Exit criteria:
- No runtime server code imports or instantiates sharetribe-flex-sdk.

Estimated effort: M-L

### Phase 5: Final removal and hardening

1. Remove sharetribe-flex-sdk and sharetribe-scripts from dependencies.
2. Delete obsolete env variables from templates and deployment configs.
3. Update docs and run full regression test pass.

Exit criteria:
- Grep for sharetribe-flex-sdk and sdk. calls returns only historical docs/changelog or intentionally retained compatibility docs.

Estimated effort: S-M

## Replace/defer checklist (execution)

- [ ] Replace now: package scripts away from sharetribe-scripts.
- [ ] Replace now: frontend transaction/checkout/inbox/payment SDK calls.
- [ ] Replace now: server privileged transaction endpoints using SDK.
- [ ] Replace now: central server SDK utility dependency chain.
- [ ] Replace now: listing/search/profile/account SDK paths not yet migrated.
- [ ] Defer: login-as and IDP endpoints if feature unused.
- [ ] Defer: sitemap/robots/webmanifest SDK integration until core user flows are stable.
- [ ] Keep behind toggle short-term: useSharetribeConsole switches while migration is incomplete.
- [ ] Remove last: Sharetribe env variables and docs references after code migration lands.

## Immediate next implementation slice

Recommended first coding slice:
1. Replace CheckoutPage.duck transaction initiation/speculative calls with backend API calls.
2. Replace TransactionPage.duck transition/show/messages calls with backend API calls.
3. Add compatibility mappers so current UI components continue to receive expected entities.

Why first:
- This removes the largest runtime dependency cluster and unlocks buyer/seller core flows for production.
