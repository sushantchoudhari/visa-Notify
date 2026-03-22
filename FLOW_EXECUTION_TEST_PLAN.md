# End-To-End Flow Execution Test Plan

This guide is for executing the full payment to callback to notification flow in local or test environments.

## 1) Objective

Validate this end-to-end journey:
1. Create application and payment
2. Redirect user to provider payment page
3. User completes payment and returns
4. Backend confirms payment via webhook or fallback reconcile
5. Service sends notification
6. Notify callback updates final delivery status in DB

## 2) Prerequisites

1. Service is running:

```bash
npm install
npm run db:migrate
npm run dev
```

2. Health check passes:

```bash
curl -s http://localhost:3000/health
```

3. .env is configured with real or sandbox keys:
- DATABASE_URL
- GOV_PAY_API_KEY
- GOV_PAY_WEBHOOK_SECRET
- GOV_NOTIFY_API_KEY

## 3) Step-By-Step Execution

## Step A: Create application

```bash
curl -s -X POST http://localhost:3000/api/v1/applications \
  -H "Content-Type: application/json" \
  -d '{"applicantRef":"e2e-applicant-001"}'
```

Expected:
- HTTP 201
- Response includes application id

Save value:
- APPLICATION_ID = data.id

## Step B: Create payment

```bash
curl -s -X POST http://localhost:3000/api/v1/payments \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "APPLICATION_ID",
    "amount": 1000,
    "reference": "e2e-ref-001",
    "description": "E2E payment",
    "returnUrl": "https://example.com/payment/success?paymentId=LOCAL_PAYMENT_ID"
  }'
```

Expected:
- HTTP 201
- Response includes:
  - local payment id as data.id
  - provider payment id as data.govPayPaymentId
  - redirect URL as data.govPayNextUrl

Save values:
- PAYMENT_ID = data.id
- GOV_PAY_PAYMENT_ID = data.govPayPaymentId
- NEXT_URL = data.govPayNextUrl

## Step C: Redirect user

Manual browser action:
1. Open NEXT_URL
2. Complete test payment on provider page
3. Confirm browser returns to returnUrl

Expected UI behavior:
- Show pending message: Payment received. We are confirming it.

## Step D: Wait for webhook processing

The backend poller runs every 10 seconds.

Check payment status:

```bash
curl -s http://localhost:3000/api/v1/payments/PAYMENT_ID
```

Expected:
- status changes from CREATED or IN_PROGRESS to terminal value when processed

## Step E: Fallback if webhook is missed

If status is still non-terminal, trigger reconcile:

```bash
curl -s http://localhost:3000/api/v1/payments/PAYMENT_ID/status
```

Repeat every 10-15 seconds for up to 5 minutes.

Expected terminal statuses:
- SUCCEEDED
- FAILED
- CANCELLED
- ERROR

## Step F: Send Notify after successful payment

Important:
- Current implementation does not auto-trigger Notify on payment success.
- Execute this step manually after payment status is SUCCEEDED.

Email example:

```bash
curl -s -X POST http://localhost:3000/api/v1/notifications/email \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "APPLICATION_ID",
    "templateId": "11111111-1111-1111-1111-111111111111",
    "emailAddress": "tester@example.com",
    "personalisation": {"name":"Alex"},
    "reference": "e2e-notify-email-001"
  }'
```

SMS example:

```bash
curl -s -X POST http://localhost:3000/api/v1/notifications/sms \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "APPLICATION_ID",
    "templateId": "22222222-2222-2222-2222-222222222222",
    "phoneNumber": "+447700900000",
    "personalisation": {"code":"123456"},
    "reference": "e2e-notify-sms-001"
  }'
```

Expected:
- HTTP 202
- Response includes local notification id

## Step G: Simulate Notify callback

Email callback:

```bash
curl -s -X POST http://localhost:3000/api/v1/notify/callbacks/email \
  -H "Content-Type: application/json" \
  -d '{
    "id":"notify-provider-id-001",
    "reference":"e2e-notify-email-001",
    "to":"tester@example.com",
    "status":"delivered",
    "created_at":"2026-03-22T10:00:00.000Z",
    "completed_at":"2026-03-22T10:00:05.000Z",
    "sent_at":"2026-03-22T10:00:01.000Z",
    "notification_type":"email",
    "template_id":"11111111-1111-1111-1111-111111111111",
    "template_version":1
  }'
```

Expected:
- HTTP 200
- Body is {"received": true}

## 4) Validation Matrix

1. Payment webhook valid signature -> 200 and event stored
2. Payment webhook invalid signature -> 401
3. Reconcile endpoint updates status when webhook is delayed
4. Payment transition rules prevent invalid state jumps
5. Notify send stores notification as SENT on provider acceptance
6. Notify callback updates final status in notification record

## 5) Typical Failure Cases

1. applicationId Invalid uuid
- Cause: placeholder string used
- Fix: use real APPLICATION_ID from Step A

2. 401 Unauthorized from GOV.UK Pay
- Cause: invalid GOV_PAY_API_KEY
- Fix: use valid sandbox key

3. 401 on webhook endpoint
- Cause: missing or bad Pay-Signature
- Fix: compute HMAC from raw body with GOV_PAY_WEBHOOK_SECRET

4. 422 VALIDATION_ERROR for Notify callback
- Cause: payload missing required fields
- Fix: include required callback schema fields

## 6) Tester Sign-Off Checklist

1. Full payment path executed end-to-end
2. Final payment terminal status observed
3. Notify send endpoint tested
4. Notify callback endpoint tested
5. Notification status update confirmed
6. Webhook fallback reconcile tested
