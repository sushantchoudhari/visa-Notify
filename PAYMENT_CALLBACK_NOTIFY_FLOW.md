# Payment Callback And Notify Flow

This document describes only the flow after a payment has been created and the user has completed the payment journey.

Scope:
1. Payment success or failure callback handling
2. Webhook verification and DB updates
3. Fallback reconciliation if webhook is missed
4. Notify send after successful payment
5. Notify callback processing and DB status updates

## 0) Local Dummy Mode (No Real GOV.UK Integration)

For local testing without real GOV.UK keys, enable mock mode:

1. Set `USE_MOCK_SERVICES=true` in `.env`
2. Restart server

Mock behavior:
1. Payment create returns a mock provider payment id and checkout URL.
2. Payment status endpoint simulates progression:
  - first fetch: `started` (maps to `IN_PROGRESS`)
  - second fetch: `success` (maps to `SUCCEEDED`)
3. Notify email/SMS send returns a mock notification id and marks local notification as `SENT`.

Note:
1. Webhook signature verification still works normally.
2. You can continue testing callback endpoints with sample payloads.

## 1) End-To-End Flow

1. Backend creates payment earlier in the journey.
2. User completes payment on the provider page.
3. Provider redirects user back to the frontend success page.
4. Backend does not trust browser return as final proof.
5. Provider webhook hits backend.
6. Backend verifies webhook signature and stores webhook event.
7. Background poller processes webhook event.
8. Backend fetches latest payment status from provider.
9. Backend updates local payment status in DB.
10. If final payment status is successful, service can send Notify email or SMS.
11. GOV.UK Notify accepts notification request and returns Notify notification id.
12. Backend stores notification as `SENT`.
13. GOV.UK Notify later sends callback to backend.
14. Backend updates notification status in DB from callback payload.

## 2) Payment Callback Handling

Webhook endpoint:

```text
POST /api/v1/pay/webhooks
```

Current behavior:
1. Raw request body is captured for signature verification.
2. `Pay-Signature` header is verified using HMAC SHA-256.
3. Invalid or missing signature returns `401 UNAUTHORIZED`.
4. Valid webhook payload is saved into `webhook_events`.
5. Processing happens asynchronously through the poller.

Expected webhook response:

```json
{"received":true}
```

## 3) Payment Status Update Rules

Provider statuses are mapped to internal statuses:

1. `created` -> `CREATED`
2. `started` -> `IN_PROGRESS`
3. `submitted` -> `IN_PROGRESS`
4. `capturable` -> `IN_PROGRESS`
5. `success` -> `SUCCEEDED`
6. `failed` -> `FAILED`
7. `cancelled` -> `CANCELLED`
8. `error` -> `ERROR`

Allowed transitions:

1. `CREATED -> IN_PROGRESS`
2. `CREATED -> FAILED`
3. `CREATED -> CANCELLED`
4. `CREATED -> ERROR`
5. `IN_PROGRESS -> SUCCEEDED`
6. `IN_PROGRESS -> FAILED`
7. `IN_PROGRESS -> CANCELLED`
8. `IN_PROGRESS -> ERROR`

Validation behavior:
1. Unknown provider status causes mapping failure.
2. Invalid transition is skipped.
3. Existing DB status is preserved if transition is invalid.
4. Terminal states are not changed again.

Practical example:
1. If provider says `success` while local status is still `CREATED`, update is skipped.
2. If provider says `failed` after payment is already `SUCCEEDED`, update is skipped because payment is terminal.

## 4) Missed Webhook Fallback

If webhook is delayed or never arrives, backend fallback is available.

Fallback endpoint:

```text
GET /api/v1/payments/:id/status
```

Fallback behavior:
1. Backend fetches current payment state from provider API.
2. Backend maps provider status to local status.
3. Backend validates transition rules before updating DB.
4. Backend stores reconciliation event in `payment_events`.

Recommended usage:
1. Frontend lands on success page.
2. Show `Payment received. We are confirming it.`
3. Trigger one immediate reconcile call.
4. If still pending, retry every 10 to 15 seconds.
5. Stop polling when payment reaches terminal state.

## 5) Notify Flow After Payment Success

Target business flow:

1. Payment becomes successful.
2. Service sends Notify email or SMS.
3. Notify delivers message.
4. Notify callback updates local notification status.

Current implementation status:
1. Payment success handling is implemented.
2. Notify send endpoints are implemented.
3. Notify callback endpoints are implemented.
4. Automatic trigger from successful payment to Notify send is not implemented yet.

That means:
1. The system can send notifications.
2. The system can process notification callbacks.
3. But a successful payment does not automatically call Notify unless an additional orchestration step is added.

## 6) Notify Send Endpoints

Available endpoints:

```text
POST /api/v1/notifications/email
POST /api/v1/notifications/sms
```

Email request example:

```json
{
  "applicationId": "<application-id>",
  "templateId": "11111111-1111-1111-1111-111111111111",
  "emailAddress": "tester@example.com",
  "personalisation": {
    "first_name": "Alex"
  },
  "reference": "payment-success-email-001"
}
```

SMS request example:

```json
{
  "applicationId": "<application-id>",
  "templateId": "22222222-2222-2222-2222-222222222222",
  "phoneNumber": "+447700900000",
  "personalisation": {
    "code": "123456"
  },
  "reference": "payment-success-sms-001"
}
```

Send behavior:
1. Notification row is created in DB with `PENDING`.
2. GOV.UK Notify API is called.
3. If accepted, notification is updated to `SENT` and `notifyNotificationId` is saved.
4. If request fails, notification is updated to `FAILED`.

## 7) Notify Callback Handling

Callback endpoints:

```text
POST /api/v1/notify/callbacks/email
POST /api/v1/notify/callbacks/sms
```

Security requirement:
1. Callback request must include `Authorization: Bearer <NOTIFY_CALLBACK_BEARER_TOKEN>`.
2. Missing or wrong bearer token returns `401 UNAUTHORIZED`.

Callback payload fields used:

```json
{
  "id": "notify-id-001",
  "reference": "payment-success-email-001",
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

Callback behavior:
1. API layer validates bearer token.
2. API layer validates payload and channel-route consistency.
3. API layer creates deterministic callback `externalEventId` and enqueues callback idempotently.
4. API layer returns `200` immediately after enqueue.
5. Async worker polls pending `GOV_NOTIFY` callback queue events.
6. Worker maps Notify status to internal event and local notification status.
7. Worker writes `notification_events` record.
8. Worker updates notification status with forward-only transition checks.
9. Worker marks queue event as `PROCESSED` or `FAILED`.
10. If local notification is not found, worker safely no-ops (idempotent retry-safe behavior).

Expected callback response:

```json
{"received":true}
```

Callback request example (email):

```bash
curl -s -X POST http://localhost:3000/api/v1/notify/callbacks/email \
  -H "Authorization: Bearer notify-callback-local-token" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "mock_notify_123",
    "reference": "payment-success-email-001",
    "to": "tester@example.com",
    "status": "delivered",
    "created_at": "2026-03-23T10:00:00.000000Z",
    "completed_at": "2026-03-23T10:00:10.000000Z",
    "sent_at": "2026-03-23T10:00:01.000000Z",
    "notification_type": "email",
    "template_id": "11111111-1111-1111-1111-111111111111",
    "template_version": 1
  }'
```

## 8) Notify Status Mapping

Notify callback statuses map as follows:

1. `created` -> event `SENT`, DB status `SENT`
2. `sending` -> event `SENT`, DB status `SENT`
3. `pending` -> event `SENT`, DB status `SENT`
4. `delivered` -> event `DELIVERED`, DB status `DELIVERED`
5. `permanent-failure` -> event `PERMANENT_FAILURE`, DB status `PERMANENT_FAILURE`
6. `temporary-failure` -> event `TEMPORARY_FAILURE`, DB status `FAILED`
7. `technical-failure` -> event `TECHNICAL_FAILURE`, DB status `TECHNICAL_FAILURE`
8. Any unknown status -> event `FAILED`, DB status `FAILED`

Terminal Notify statuses:
1. `DELIVERED`
2. `PERMANENT_FAILURE`

If notification is already terminal, later callback updates are ignored.

## 9) Recommended Final Business Flow

Recommended post-payment design:

1. Payment is created.
2. User pays.
3. Backend confirms payment by webhook or reconcile fallback.
4. When payment becomes `SUCCEEDED`, backend triggers Notify send.
5. Frontend shows payment confirmed independently from email delivery.
6. Notify callback updates final delivery state later.

Important rule:
1. Payment confirmation and email delivery are separate asynchronous processes.
2. Do not treat Notify acceptance as proof of delivery.
3. Use Notify callback as final source of truth for delivery result.

## 10) Minimal Tester Checklist

1. Valid payment webhook returns `200`.
2. Invalid payment webhook signature returns `401`.
3. Payment status updates only on valid transitions.
4. Reconcile endpoint updates payment when webhook is missed.
5. Notify email or SMS request creates notification row.
6. Notify accepted response moves notification to `SENT`.
7. Notify callback updates final notification status.
8. Unknown or invalid notification callback payload returns validation error.
