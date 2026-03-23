# Payment Event Coverage Analysis

## Official GOV.UK Pay Events

From the [GOV.UK Pay Webhooks Documentation](https://docs.payments.service.gov.uk/webhooks/), GOV.UK Pay supports these events:

> "You can receive updates when:
> - a payment succeeds
> - a payment fails
> - a payment expires
> - a payment is captured
> - a payment is settled
> - a payment is refunded"

---

## Current Implementation Coverage

### ✅ **Captured via Webhook Events** (4 event types)

| User-Facing Event | Official Event Type | Webhook Sent | Status Mapping |
|---|---|---|---|
| ✅ Payment succeeds | `card_payment_succeeded` | YES | Maps to `SUCCEEDED` |
| ✅ Payment is captured | `card_payment_captured` | YES | Maps to `IN_PROGRESS` → `SUCCEEDED` |
| ✅ Payment is settled | `card_payment_settled` | YES | Maps to `SUCCEEDED` (confirmed settlement) |
| ✅ Payment is refunded | `card_payment_refunded` | YES | Notify event (separate module) |

### ❌ **NOT Captured via Webhook** (2 missing event types)

| User-Facing Event | How It's Handled | Current Status |
|---|---|---|
| ❌ Payment fails | **Via polling** — `processPendingEvents()` calls `getPayment()` every 10s | ⚠️ DELAYED (up to 10s lag) |
| ❌ Payment expires | **Via polling** — `processPendingEvents()` calls `getPayment()` every 10s | ⚠️ DELAYED (up to 10s lag) |

---

## Problem: Failure & Expiration Detection Gap

GOV.UK Pay **does NOT send separate webhook events** for:
- Payment failure (rejected card, etc.)
- Payment expiration (user doesn't complete in time)

### How These Are Currently Handled

#### Option 1: Polling (Current Implementation)
```typescript
// Every 10 seconds, processPendingEvents() calls:
const govPayPayment = await govPayClient.getPayment(paymentId);
const newStatus = paymentDomain.mapGovPayStatus(govPayPayment.state.status);
```

**Problem:** Up to **10-second delay** before failure/expiration is detected  
**Advantage:** Handles all state transitions including failures

#### The Payment State Statuses from GOV.UK Pay

When you call `GET /v1/payments/:paymentId`, the response includes:

```json
{
  "state": {
    "status": "success|failed|cancelled|error",
    "finished": true|false
  }
}
```

**State transitions:**
- `created` → `started` → `submitted` → `capturable` → `success` (success path)
- `created` → `started` → `submitted` → `failed` (failure — rejected card)
- `created` → `expired` (user timeout)
- `created` → `error` (system error)

---

## Recommended Fix: Hybrid Approach

To capture **failures and expirations immediately**, you should:

### 1. **Keep Webhook Events as Primary** (for major milestones)
   - ✅ `card_payment_succeeded` — Payment authorized
   - ✅ `card_payment_captured` — Payment taken from account
   - ✅ `card_payment_settled` — Payment sent to your bank

### 2. **Add Parallel Event Subscription for Failures**
GOV.UK Pay admin tool allows subscribing to individual event types. You should create a **second webhook** for:
- **Unknown status change events** — if available

### 3. **Keep Smart Polling** (for safety net)
- Poll only **non-terminal payments** (don't re-poll SUCCEEDED)
- Reduce polling interval when payment is in critical states (`CREATED`, `IN_PROGRESS`)
- Use exponential backoff for failures

---

## Mapping: Your Internal Statuses

```typescript
enum PaymentStatus {
  CREATED = 'CREATED',           // ← Payment just created, watch for failure
  IN_PROGRESS = 'IN_PROGRESS',   // ← User filling form or card processing, watch for timeout/failure  
  SUCCEEDED = 'SUCCEEDED',        // ← Webhook: card_payment_succeeded
  FAILED = 'FAILED',              // ← From polling: state.status === 'failed'
  CANCELLED = 'CANCELLED',        // ← From polling: state.status === 'cancelled'
  ERROR = 'ERROR',                // ← From polling: state.status === 'error'
}
```

| Internal Status | Detected By | Event Type | Lag |
|---|---|---|---|
| `CREATED` | Initial create response | N/A | Immediate |
| `IN_PROGRESS` | Webhook: `card_payment_succeeded` OR polling | Webhook/Poll | <1s / 10s |
| `SUCCEEDED` | Webhook: `card_payment_succeeded` OR polling | Webhook/Poll | <1s / 10s |
| `FAILED` | **Polling only** | None | **~10s** ⚠️ |
| `CANCELLED` | **Polling only** | None | **~10s** ⚠️ |
| `ERROR` | **Polling only** | None | **~10s** ⚠️ |
| EXPIRED | **Polling only** | None | **~10s** ⚠️ |

---

## Current Implementation

### Check: [src/modules/pay-webhooks/payWebhook.domain.ts](../src/modules/pay-webhooks/payWebhook.domain.ts)
```typescript
export const PAY_EVENT_TYPES = [
  'card_payment_succeeded',   // ✅
  'card_payment_captured',    // ✅
  'card_payment_settled',     // ✅
  'card_payment_refunded',    // ✅
] as const;
```

### Check: [src/modules/pay-webhooks/payWebhook.service.ts](../src/modules/pay-webhooks/payWebhook.service.ts)
```typescript
async processPendingEvents(): Promise<void> {
  // ... polling logic every 10s
  const govPayPayment = await govPayClient.getPayment(paymentId);
  const newStatus = paymentDomain.mapGovPayStatus(govPayPayment.state.status);
  // ... updates DB with new status
}
```

---

## Recommendation

**Your current approach is correct**, but **document the delay**:

> ✅ **Payment Success:** Captured via webhook (~100ms)  
> ✅ **Payment Capture:** Captured via webhook (~100ms)  
> ✅ **Payment Settlement:** Captured via webhook (~100ms)  
> ⚠️ **Payment Failure:** Detected via polling (up to 10s delay)  
> ⚠️ **Payment Expiration:** Detected via polling (up to 10s delay)

If <1s response for failures is critical, you would need to:
1. Call `GET /v1/payments/:paymentId` **synchronously** in your payment creation flow (before returning to user)
2. Implement **smarter polling** that increases frequency for non-terminal payments
3. Consider a **second webhook** if GOV.UK Pay adds failure webhooks in the future

For most government services, a 10-second delay on failure detection is acceptable since payment failures are already communicated to the user on the GOV.UK Pay hosted page before they return to your app.
