# End-To-End Backend Flow Test Plan (Values + Examples)

This document gives a complete, testable flow for this backend with exact payload examples and expected outcomes.

## 1) What This Covers

1. Application create
2. Payment create
3. Payment status fetch and reconcile fallback
4. GOV.UK Pay webhook callback (signed payload)
5. Notify email and SMS send
6. Notify delivery callback handling

## 2) Base URLs And Endpoints

Base URL:

```bash
http://localhost:3000
```

API endpoints:

1. `POST /api/v1/applications`
2. `GET /api/v1/applications/:id`
3. `POST /api/v1/payments`
4. `GET /api/v1/payments/:id`
5. `GET /api/v1/payments/:id/status`
6. `POST /api/v1/pay/webhooks`
7. `POST /api/v1/notifications/email`
8. `POST /api/v1/notifications/sms`
9. `POST /api/v1/notify/callbacks/email`
10. `POST /api/v1/notify/callbacks/sms`

## 3) Prerequisites

Run service:

```bash
npm install
npm run db:migrate
npm run dev
```

Health check:

```bash
curl -s http://localhost:3000/health
```

Required env keys:

1. `DATABASE_URL`
2. `GOV_PAY_API_KEY`
3. `GOV_PAY_WEBHOOK_SECRET`
4. `GOV_NOTIFY_API_KEY`
5. `USE_MOCK_SERVICES`

Recommended for local full testing without real integrations:

```env
USE_MOCK_SERVICES=true
```

## 4) Full Runnable Flow (Copy-Paste)

Open a terminal in repo root and run:

```bash
BASE_URL="http://localhost:3000"
```

### Step A: Create application

```bash
APP_RES=$(curl -s -X POST "$BASE_URL/api/v1/applications" \
  -H "Content-Type: application/json" \
  -d '{"applicantRef":"e2e-applicant-001"}')

echo "$APP_RES"
APPLICATION_ID=$(echo "$APP_RES" | jq -r '.data.id')
echo "APPLICATION_ID=$APPLICATION_ID"
```

Expected:

1. HTTP `201`
2. `data.id` is UUID
3. `data.status` is `APPLICATION_CREATED`

### Step B: Create payment

```bash
PAY_RES=$(curl -s -X POST "$BASE_URL/api/v1/payments" \
  -H "Content-Type: application/json" \
  -d "{
    \"applicationId\": \"$APPLICATION_ID\",
    \"amount\": 1000,
    \"reference\": \"e2e-ref-001\",
    \"description\": \"Visa application fee\",
    \"returnUrl\": \"https://example.com/payment/complete\",
    \"metadata\": {\"journey\": \"e2e\", \"attempt\": 1, \"priority\": true}
  }")

echo "$PAY_RES"
PAYMENT_ID=$(echo "$PAY_RES" | jq -r '.data.id')
GOV_PAY_PAYMENT_ID=$(echo "$PAY_RES" | jq -r '.data.govPayPaymentId')
GOV_PAY_NEXT_URL=$(echo "$PAY_RES" | jq -r '.data.govPayNextUrl')

echo "PAYMENT_ID=$PAYMENT_ID"
echo "GOV_PAY_PAYMENT_ID=$GOV_PAY_PAYMENT_ID"
echo "GOV_PAY_NEXT_URL=$GOV_PAY_NEXT_URL"
```

Expected:

1. HTTP `201`
2. `data.id` local payment UUID
3. `data.govPayPaymentId` provider ID
4. `data.govPayNextUrl` redirect URL

### Step C: Read payment state

```bash
curl -s "$BASE_URL/api/v1/payments/$PAYMENT_ID"
```

Expected initial status:

1. `CREATED` or `IN_PROGRESS`

### Step D: Reconcile fallback status

```bash
curl -s "$BASE_URL/api/v1/payments/$PAYMENT_ID/status"
curl -s "$BASE_URL/api/v1/payments/$PAYMENT_ID/status"
```

Expected:

1. In mock mode, first call remains in-progress path
2. In mock mode, second call moves to `SUCCEEDED`
3. In real mode, status depends on provider state

### Step E: Send Notify email

```bash
EMAIL_RES=$(curl -s -X POST "$BASE_URL/api/v1/notifications/email" \
  -H "Content-Type: application/json" \
  -d "{
    \"applicationId\": \"$APPLICATION_ID\",
    \"templateId\": \"11111111-1111-1111-1111-111111111111\",
    \"emailAddress\": \"simulate-delivered@notifications.service.gov.uk\",
    \"personalisation\": {\"name\": \"Alex\", \"caseRef\": \"E2E-001\"},
    \"reference\": \"notify-email-e2e-001\"
  }")

echo "$EMAIL_RES"
LOCAL_EMAIL_NOTIFICATION_ID=$(echo "$EMAIL_RES" | jq -r '.data.notificationId')
echo "LOCAL_EMAIL_NOTIFICATION_ID=$LOCAL_EMAIL_NOTIFICATION_ID"
```

Expected:

1. HTTP `202`
2. Returns local notification record ID in `data.notificationId`

### Step F: Send Notify SMS

```bash
SMS_RES=$(curl -s -X POST "$BASE_URL/api/v1/notifications/sms" \
  -H "Content-Type: application/json" \
  -d "{
    \"applicationId\": \"$APPLICATION_ID\",
    \"templateId\": \"22222222-2222-2222-2222-222222222222\",
    \"phoneNumber\": \"07700900000\",
    \"personalisation\": {\"otp\": 123456},
    \"reference\": \"notify-sms-e2e-001\"
  }")

echo "$SMS_RES"
LOCAL_SMS_NOTIFICATION_ID=$(echo "$SMS_RES" | jq -r '.data.notificationId')
echo "LOCAL_SMS_NOTIFICATION_ID=$LOCAL_SMS_NOTIFICATION_ID"
```

Expected:

1. HTTP `202`
2. Returns local notification record ID

### Step G: Simulate Notify callback payload

Notify callback schema in this service requires:

1. `id`
2. `reference`
3. `to`
4. `status`
5. `created_at`
6. `completed_at`
7. `sent_at`
8. `notification_type`
9. `template_id`
10. `template_version`

Use a real provider notification ID from DB (recommended), otherwise event may be ignored if no matching record exists.

Example DB lookup:

```bash
psql "$DATABASE_URL" -c "select id, notify_notification_id, recipient, status from notifications order by created_at desc limit 10;"
```

Then call callback:

```bash
CALLBACK_TOKEN="notify-callback-local-token"

curl -s -X POST "$BASE_URL/api/v1/notify/callbacks/email" \
  -H "Authorization: Bearer $CALLBACK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "PUT_NOTIFY_NOTIFICATION_ID_HERE",
    "reference": "notify-email-e2e-001",
    "to": "simulate-delivered@notifications.service.gov.uk",
    "status": "delivered",
    "created_at": "2026-03-23T10:00:00.000000Z",
    "completed_at": "2026-03-23T10:00:05.000000Z",
    "sent_at": "2026-03-23T10:00:01.000000Z",
    "notification_type": "email",
    "template_id": "11111111-1111-1111-1111-111111111111",
    "template_version": 1
  }'
```

Expected:

1. HTTP `200`
2. Response `{ "received": true }`
3. Callback is queued first; final status update is applied asynchronously by poller (within poll interval).

## 5) GOV.UK Pay Webhook Callback Test (Signed)

Create payload:

```bash
WEBHOOK_PAYLOAD=$(cat <<JSON
{
  "webhook_message_id": "whm_e2e_001",
  "api_version": 1,
  "created_date": "2026-03-23T11:00:00.000Z",
  "resource_id": "$GOV_PAY_PAYMENT_ID",
  "resource_type": "payment",
  "event_type": "card_payment_captured",
  "resource": {
    "amount": 1000,
    "reference": "e2e-ref-001",
    "description": "Visa application fee",
    "language": "en",
    "payment_id": "$GOV_PAY_PAYMENT_ID",
    "payment_provider": "sandbox",
    "created_date": "2026-03-23T10:59:00.000Z",
    "state": {
      "status": "success",
      "finished": true
    },
    "return_url": "https://example.com/payment/complete",
    "delayed_capture": false,
    "moto": false
  }
}
JSON
)
```

Generate signature and call endpoint:

```bash
PAY_SIGNATURE=$(printf "%s" "$WEBHOOK_PAYLOAD" | openssl dgst -sha256 -hmac "$GOV_PAY_WEBHOOK_SECRET" -binary | xxd -p -c 256)

curl -s -X POST "$BASE_URL/api/v1/pay/webhooks" \
  -H "Content-Type: application/json" \
  -H "Pay-Signature: $PAY_SIGNATURE" \
  -d "$WEBHOOK_PAYLOAD"
```

Expected:

1. HTTP `200`
2. Response `{ "received": true }`

Negative test (invalid signature):

```bash
curl -s -X POST "$BASE_URL/api/v1/pay/webhooks" \
  -H "Content-Type: application/json" \
  -H "Pay-Signature: invalid-signature" \
  -d "$WEBHOOK_PAYLOAD"
```

Expected:

1. HTTP `401`
2. Error code `UNAUTHORIZED`

## 6) Request Value Reference (Quick Copy)

### Create application

```json
{
  "applicantRef": "e2e-applicant-001"
}
```

### Create payment

```json
{
  "applicationId": "2f03f0d7-13f1-4f21-9c59-f70efec36b20",
  "amount": 1000,
  "reference": "e2e-ref-001",
  "description": "Visa application fee",
  "returnUrl": "https://example.com/payment/complete",
  "metadata": {
    "journey": "e2e",
    "attempt": 1,
    "priority": true
  }
}
```

### Send email

```json
{
  "applicationId": "2f03f0d7-13f1-4f21-9c59-f70efec36b20",
  "templateId": "11111111-1111-1111-1111-111111111111",
  "emailAddress": "simulate-delivered@notifications.service.gov.uk",
  "personalisation": {
    "name": "Alex",
    "caseRef": "E2E-001"
  },
  "reference": "notify-email-e2e-001"
}
```

### Send SMS

```json
{
  "applicationId": "2f03f0d7-13f1-4f21-9c59-f70efec36b20",
  "templateId": "22222222-2222-2222-2222-222222222222",
  "phoneNumber": "07700900000",
  "personalisation": {
    "otp": 123456
  },
  "reference": "notify-sms-e2e-001"
}
```

## 7) Common Errors And Fixes

1. `VALIDATION_ERROR` on `applicationId`
   - Use a real UUID from `POST /applications`.
2. `GOV_PAY_UNAUTHORIZED`
   - Fix `GOV_PAY_API_KEY` or use mock mode.
3. `UNAUTHORIZED` on `/api/v1/pay/webhooks`
   - Signature does not match raw payload and webhook secret.
4. Notify callback accepted but no DB update
   - Callback `id` does not match stored `notify_notification_id`.

## 8) Sign-Off Checklist

1. Application created successfully
2. Payment created successfully
3. Reconcile endpoint tested
4. Pay webhook endpoint tested with valid and invalid signature
5. Notify email and SMS send tested
6. Notify callback tested with valid payload
7. Final statuses verified in API/DB
