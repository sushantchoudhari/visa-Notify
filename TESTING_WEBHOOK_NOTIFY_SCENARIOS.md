# Webhook + Notify Callback Test Scenarios

This document is focused on:
- GOV.UK Pay webhook callback testing (especially payment failure cases)
- GOV.UK Notify callback scenario testing (email/sms status transitions)

Use with local API at `http://localhost:3000`.

## 1) Preconditions

1. Start API:

```bash
npm run dev
```

2. Confirm health:

```bash
curl -s http://localhost:3000/health
```

3. Ensure `.env` has:
- `GOV_PAY_WEBHOOK_SECRET=<your-secret>`
- `DATABASE_URL=<working-postgres-url>`

## 2) Payment Webhook Callback Testing

Endpoint:

```bash
POST http://localhost:3000/api/v1/pay/webhooks
```

### 2.1 Create payload file (payment failed)

Create `payload-payment-failed.json`:

```json
{
  "payment_id": "pay_test_failed_001",
  "payment_provider": "sandbox",
  "created_date": "2026-03-20T10:00:00.000Z",
  "event_date": "2026-03-20T10:05:00.000Z",
  "event_type": "payment_failed",
  "state": {
    "status": "failed",
    "finished": true,
    "message": "Card declined",
    "code": "P0020"
  },
  "resource_id": "res_failed_001",
  "resource_type": "payment"
}
```

### 2.2 Generate `Pay-Signature` header (HMAC SHA-256)

```bash
export PAY_WEBHOOK_SECRET='your_webhook_signing_secret_here'
export PAY_SIGNATURE=$(cat payload-payment-failed.json | openssl dgst -sha256 -hmac "$PAY_WEBHOOK_SECRET" -hex | sed 's/^.* //')
echo "$PAY_SIGNATURE"
```

### 2.3 Send valid failure webhook

```bash
curl -i -X POST http://localhost:3000/api/v1/pay/webhooks \
  -H "Content-Type: application/json" \
  -H "Pay-Signature: $PAY_SIGNATURE" \
  --data-binary @payload-payment-failed.json
```

Expected:
- HTTP `200`
- Body:

```json
{"received":true}
```

Notes:
- Event is saved first and processed asynchronously by poller.
- Poller runs every 10 seconds.

### 2.4 Invalid signature scenario

```bash
curl -i -X POST http://localhost:3000/api/v1/pay/webhooks \
  -H "Content-Type: application/json" \
  -H "Pay-Signature: invalid_signature" \
  --data-binary @payload-payment-failed.json
```

Expected:
- HTTP `401`
- Error code: `UNAUTHORIZED`

### 2.5 Missing signature scenario

```bash
curl -i -X POST http://localhost:3000/api/v1/pay/webhooks \
  -H "Content-Type: application/json" \
  --data-binary @payload-payment-failed.json
```

Expected:
- HTTP `401`
- Error code: `UNAUTHORIZED`

### 2.6 Duplicate webhook delivery (idempotency)

Send the same payload with same `event_date` + `event_type` + `payment_id` twice.

Expected:
- Both requests return `200`.
- Only one webhook row is kept logically (`externalEventId` is unique and upserted).

### 2.7 Other payment webhook event types to test

Use the same JSON shape and vary:
- `event_type`: `payment_created`
- `event_type`: `payment_started`
- `event_type`: `payment_succeeded`
- `event_type`: `payment_cancelled`
- `event_type`: `payment_expired`

For refunds:
- `event_type`: `refund_created`
- `event_type`: `refund_succeeded`
- `event_type`: `refund_failed`

## 3) Notify Callback Scenarios (Email + SMS)

Endpoints:

```bash
POST http://localhost:3000/api/v1/notify/callbacks/email
POST http://localhost:3000/api/v1/notify/callbacks/sms
```

Important behavior:
- Callback payload is validated with Zod.
- If payload is valid, endpoint returns `200` with `{ "received": true }`.
- Unknown `status` maps to event type `FAILED` and notification status `FAILED`.
- If notification ID does not exist in DB, endpoint still returns `200`.

## 4) Notify Status Mapping Matrix

Status mapping used by service:

1. `created` -> event `SENT`, notification status `SENT`
2. `sending` -> event `SENT`, notification status `SENT`
3. `pending` -> event `SENT`, notification status `SENT`
4. `delivered` -> event `DELIVERED`, notification status `DELIVERED`
5. `permanent-failure` -> event `PERMANENT_FAILURE`, notification status `PERMANENT_FAILURE`
6. `temporary-failure` -> event `TEMPORARY_FAILURE`, notification status `FAILED`
7. `technical-failure` -> event `TECHNICAL_FAILURE`, notification status `TECHNICAL_FAILURE`
8. any unknown value -> event `FAILED`, notification status `FAILED`

## 5) Reusable Notify Callback Payload Template

Use this template and change `status` + `notification_type`:

```json
{
  "id": "notify-id-001",
  "reference": "notify-ref-001",
  "to": "tester@example.com",
  "status": "delivered",
  "created_at": "2026-03-20T10:00:00.000Z",
  "completed_at": "2026-03-20T10:00:10.000Z",
  "sent_at": "2026-03-20T10:00:01.000Z",
  "notification_type": "email",
  "template_id": "11111111-1111-1111-1111-111111111111",
  "template_version": 1
}
```

## 6) Scenario Commands for Notify

### 6.1 Delivered (email)

```bash
curl -i -X POST http://localhost:3000/api/v1/notify/callbacks/email \
  -H "Content-Type: application/json" \
  -d '{
    "id":"notify-id-email-delivered-001",
    "reference":"ref-email-001",
    "to":"tester@example.com",
    "status":"delivered",
    "created_at":"2026-03-20T10:00:00.000Z",
    "completed_at":"2026-03-20T10:00:10.000Z",
    "sent_at":"2026-03-20T10:00:01.000Z",
    "notification_type":"email",
    "template_id":"11111111-1111-1111-1111-111111111111",
    "template_version":1
  }'
```

### 6.2 Permanent failure (email)

```bash
curl -i -X POST http://localhost:3000/api/v1/notify/callbacks/email \
  -H "Content-Type: application/json" \
  -d '{
    "id":"notify-id-email-permfail-001",
    "reference":"ref-email-002",
    "to":"tester@example.com",
    "status":"permanent-failure",
    "created_at":"2026-03-20T10:00:00.000Z",
    "completed_at":"2026-03-20T10:00:10.000Z",
    "sent_at":"2026-03-20T10:00:01.000Z",
    "notification_type":"email",
    "template_id":"11111111-1111-1111-1111-111111111111",
    "template_version":1
  }'
```

### 6.3 Temporary failure (sms)

```bash
curl -i -X POST http://localhost:3000/api/v1/notify/callbacks/sms \
  -H "Content-Type: application/json" \
  -d '{
    "id":"notify-id-sms-tempfail-001",
    "reference":"ref-sms-001",
    "to":"+447700900000",
    "status":"temporary-failure",
    "created_at":"2026-03-20T10:00:00.000Z",
    "completed_at":"2026-03-20T10:00:10.000Z",
    "sent_at":"2026-03-20T10:00:01.000Z",
    "notification_type":"sms",
    "template_id":"22222222-2222-2222-2222-222222222222",
    "template_version":1
  }'
```

### 6.4 Technical failure (sms)

```bash
curl -i -X POST http://localhost:3000/api/v1/notify/callbacks/sms \
  -H "Content-Type: application/json" \
  -d '{
    "id":"notify-id-sms-techfail-001",
    "reference":"ref-sms-002",
    "to":"+447700900000",
    "status":"technical-failure",
    "created_at":"2026-03-20T10:00:00.000Z",
    "completed_at":"2026-03-20T10:00:10.000Z",
    "sent_at":"2026-03-20T10:00:01.000Z",
    "notification_type":"sms",
    "template_id":"22222222-2222-2222-2222-222222222222",
    "template_version":1
  }'
```

### 6.5 Unknown status fallback

```bash
curl -i -X POST http://localhost:3000/api/v1/notify/callbacks/email \
  -H "Content-Type: application/json" \
  -d '{
    "id":"notify-id-email-unknown-001",
    "reference":"ref-email-003",
    "to":"tester@example.com",
    "status":"provider-weird-status",
    "created_at":"2026-03-20T10:00:00.000Z",
    "completed_at":null,
    "sent_at":"2026-03-20T10:00:01.000Z",
    "notification_type":"email",
    "template_id":"11111111-1111-1111-1111-111111111111",
    "template_version":1
  }'
```

Expected:
- HTTP `200`
- Event type stored as `FAILED`
- Notification status stored as `FAILED`

### 6.6 Invalid payload (schema validation)

Example: missing `id` field.

```bash
curl -i -X POST http://localhost:3000/api/v1/notify/callbacks/email \
  -H "Content-Type: application/json" \
  -d '{
    "reference":"ref-email-invalid-001",
    "to":"tester@example.com",
    "status":"delivered",
    "created_at":"2026-03-20T10:00:00.000Z",
    "notification_type":"email",
    "template_id":"11111111-1111-1111-1111-111111111111",
    "template_version":1
  }'
```

Expected:
- HTTP `422`
- Error code `VALIDATION_ERROR`

## 7) DB Verification Queries (Optional)

After sending callbacks/webhooks, verify records:

```bash
npx prisma studio
```

Check tables:
- `webhook_events`
- `payment_events`
- `notifications`
- `notification_events`

## 8) Quick Regression Checklist

1. Valid signed pay webhook returns `200`.
2. Invalid/missing pay signature returns `401`.
3. Duplicate pay webhook does not create duplicate event key.
4. Notify delivered updates to delivered state.
5. Notify permanent-failure updates to permanent failure state.
6. Notify temporary-failure maps to failed state.
7. Invalid notify payload returns `422`.
