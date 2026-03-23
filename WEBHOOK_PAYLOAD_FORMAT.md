# GOV.UK Pay Webhook Payload Format Specification

**Reference:** https://docs.payments.service.gov.uk/webhooks/

## ✅ Official Format (Corrected Implementation)

### Top-Level Fields

```json
{
  "webhook_message_id": "123abc",
  "api_version": 1,
  "created_date": "2019-07-11T10:36:26.988Z",
  "resource_id": "hu20sqlact5260q2nanm0q8u93",
  "resource_type": "payment",
  "event_type": "card_payment_captured",
  "resource": { ... }
}
```

| Field | Type | Description |
|---|---|---|
| `webhook_message_id` | string | Unique identifier for this webhook message |
| `api_version` | number | API version (currently 1) |
| `created_date` | ISO 8601 | ISO 8601 UTC timestamp when the event happened |
| `resource_id` | string | Payment ID (identical to `resource.payment_id`) |
| `resource_type` | string | Always `"payment"` |
| `event_type` | string | Event that triggered webhook |
| `resource` | object | Full payment details |

### Valid Event Types

Only these event types are sent by GOV.UK Pay:

```
card_payment_succeeded
card_payment_captured
card_payment_settled
card_payment_refunded
```

### Resource Object

The `resource` object contains the same fields as `GET /v1/payments/:paymentId`:

```json
{
  "amount": 5000,
  "reference": "12345",
  "description": "Pay your council tax",
  "language": "en",
  "email": "sherlock.holmes@example.com",
  "payment_id": "hu20sqlact5260q2nanm0q8u93",
  "payment_provider": "stripe",
  "created_date": "2021-10-19T10:05:45.454Z",
  "state": {
    "status": "success",
    "finished": true
  },
  "return_url": "https://your.service.gov.uk/completed",
  "refund_summary": {
    "status": "available",
    "amount_available": 5000,
    "amount_submitted": 0
  },
  "settlement_summary": {},
  "card_details": {
    "last_digits_card_number": "1234",
    "first_digits_card_number": "123456",
    "cardholder_name": "Sherlock Holmes",
    "expiry_date": "04/24",
    "billing_address": {
      "line1": "221 Baker Street",
      "line2": "Flat b",
      "postcode": "NW1 6XE",
      "city": "London",
      "country": "GB"
    },
    "card_brand": "Visa",
    "card_type": "debit"
  },
  "delayed_capture": false,
  "moto": false,
  "provider_id": "10987654321"
}
```

---

## Issues Found & Corrected

### ❌ **Issue 1: Incorrect Top-Level Structure**

**Before:**
```typescript
interface GovPayWebhookPayload {
  payment_id: string;              // ❌ NOT at top level
  payment_provider: string;        // ❌ NOT at top level
  created_date: string;            // ✓ correct
  event_date: string;              // ❌ NOT IN SPEC
  event_type: string;              // ✓ correct
  state: { ... };                  // ❌ NOT at top level
  resource_id?: string;            // ✓ correct (but optional)
  resource_type?: string;          // ✓ correct (but optional)
}
```

**Fix:** Created proper nested structure with `resource` object containing all payment details.

---

### ❌ **Issue 2: Wrong Event Types**

**Before:**
```typescript
'payment_created'        // ❌
'payment_started'        // ❌
'payment_succeeded'      // ❌ Should be: card_payment_succeeded
'payment_failed'         // ❌
'payment_cancelled'      // ❌
'payment_expired'        // ❌
'refund_created'         // ❌
'refund_succeeded'       // ❌
'refund_failed'          // ❌
```

**After:**
```typescript
'card_payment_succeeded'   // ✓ Official
'card_payment_captured'    // ✓ Official (was partially correct)
'card_payment_settled'     // ✓ Official (was partially correct)
'card_payment_refunded'    // ✓ Official (was partially correct)
```

---

### ❌ **Issue 3: Payment ID Extraction**

**Before:**
```typescript
const localPayment = payload.payment_id       // ❌ Wrong field
  ? await paymentRepository.findByGovPayId(payload.payment_id)
  : null;
```

**After:**
```typescript
const govPayPaymentId = payWebhookDomain.getPaymentId(payload);  // ✓ Uses resource_id
const localPayment = govPayPaymentId
  ? await paymentRepository.findByGovPayId(govPayPaymentId)
  : null;
```

---

## Files Modified

1. **[src/modules/pay-webhooks/payWebhook.domain.ts](../src/modules/pay-webhooks/payWebhook.domain.ts)**
   - ✅ Added proper `GovPayWebhookPayload` interface matching official spec
   - ✅ Corrected event types to official names
   - ✅ Added `getPaymentId()` helper to extract from correct field
   - ✅ Updated `buildWebhookEventArgs()` to use `resource_id`

2. **[src/modules/pay-webhooks/payWebhook.service.ts](../src/modules/pay-webhooks/payWebhook.service.ts)**
   - ✅ Updated `handleIncomingWebhook()` to use correct field extraction
   - ✅ Updated `processPendingEvents()` to use correct field extraction
   - ✅ Improved logging with event_type

---

## Testing the Webhook

### Example Webhook Curl Command

```bash
# Generate HMAC signature (replace YourWebhookSecret with your actual secret)
SIGNATURE=$(echo -n '{"webhook_message_id":"123abc","api_version":1,"created_date":"2024-03-23T15:30:00.000Z","resource_id":"payment123","resource_type":"payment","event_type":"card_payment_captured","resource":{"amount":5000,"reference":"REF123","description":"Test Payment","payment_id":"payment123","payment_provider":"stripe","created_date":"2024-03-23T15:30:00.000Z","state":{"status":"success","finished":true}}}' | openssl dgst -sha256 -hex -mac HMAC -macopt key:YourWebhookSecret | cut -d' ' -f2)

curl -X POST http://localhost:3000/api/v1/pay/webhooks \
  -H "Content-Type: application/json" \
  -H "Pay-Signature: $SIGNATURE" \
  -d '{
    "webhook_message_id": "123abc",
    "api_version": 1,
    "created_date": "2024-03-23T15:30:00.000Z",
    "resource_id": "payment123",
    "resource_type": "payment",
    "event_type": "card_payment_captured",
    "resource": {
      "amount": 5000,
      "reference": "REF123",
      "description": "Test Payment",
      "payment_id": "payment123",
      "payment_provider": "stripe",
      "created_date": "2024-03-23T15:30:00.000Z",
      "state": {
        "status": "success",
        "finished": true
      }
    }
  }'
```

---

## Key Takeaways

✅ **Always nest payment details in the `resource` object**
✅ **Use `resource_id` (not `payment_id`) at the top level**
✅ **Only handle official event types** (4 total)
✅ **Include `webhook_message_id` and `api_version`**
✅ **Extract payment status from `resource.state.status`**
✅ **Verify signature using raw request body + `Pay-Signature` header**
