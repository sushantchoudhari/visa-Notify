# GOV.UK Service Testing Guide

This guide is for manual API testing with sample data.

## 1) Start the service

```bash
npm install
npm run db:migrate
npm run dev
```

Health check:

```bash
curl -s http://localhost:3000/health
```

Expected:

```json
{"status":"ok","timestamp":"2026-03-20T10:24:01.500Z"}
```

## 2) Environment variables for local testing

Use `.env` with values like below:

```env
PORT=3000
LOG_LEVEL=info
NODE_ENV=development
DATABASE_URL="postgresql://sushant@localhost:5432/govuk_service?schema=public"

GOV_PAY_API_KEY=api_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GOV_PAY_BASE_URL=https://publicapi.payments.service.gov.uk
GOV_PAY_WEBHOOK_SECRET=your_webhook_signing_secret_here

GOV_NOTIFY_API_KEY=your-notify-api-key-here
GOV_NOTIFY_BASE_URL=https://api.notifications.service.gov.uk

ONE_LOGIN_BASE_URL=https://oidc.integration.account.gov.uk
ONE_LOGIN_CLIENT_ID=your-client-id-here

JWK_KID=key-2024-01-01
PRIVATE_KEY_PATH=./keys/private.pem
```

Notes:
- `GOV_PAY_API_KEY` and `GOV_NOTIFY_API_KEY` must be real sandbox keys to avoid `401 Unauthorized`.
- `PRIVATE_KEY_PATH` must point to a real key file.

## 3) Test data you can reuse

- `applicantRef`: `dummy-applicant-001`
- `amount`: `1000`
- `reference`: `ref-001`
- `description`: `Test payment`
- `returnUrl`: `https://example.com/return`
- email: `tester@example.com`
- phone: `+447700900000`

## 4) End-to-end payment flow

### Step A: Create application

```bash
curl -s -X POST http://localhost:3000/api/v1/applications \
  -H "Content-Type: application/json" \
  -d '{"applicantRef":"dummy-applicant-001"}'
```

Expected `201` response shape:

```json
{
  "data": {
    "id": "<application-uuid>",
    "applicantRef": "dummy-applicant-001",
    "status": "APPLICATION_CREATED",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

Save `data.id` as `APPLICATION_ID`.

### Step B: Create payment (IMPORTANT)

Do not send the literal placeholder `<paste-application-id-here>`.
It must be a real UUID from Step A.

```bash
curl -s -X POST http://localhost:3000/api/v1/payments \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "APPLICATION_ID",
    "amount": 1000,
    "reference": "ref-001",
    "description": "Test payment",
    "returnUrl": "https://example.com/return"
  }'
```

Expected outcomes:
- With valid GOV.UK Pay key: `201` with payment data.
- With placeholder/invalid key: error from upstream GOV.UK Pay (often `401 Unauthorized`).

### Step C: Fetch application and payment

```bash
curl -s http://localhost:3000/api/v1/applications/APPLICATION_ID
```

```bash
curl -s http://localhost:3000/api/v1/payments/PAYMENT_ID
```

```bash
curl -s http://localhost:3000/api/v1/payments/PAYMENT_ID/status
```

## 5) Notify endpoints

These require valid GOV.UK Notify template IDs and API key.

### Send email

```bash
curl -s -X POST http://localhost:3000/api/v1/notifications/email \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "APPLICATION_ID",
    "templateId": "11111111-1111-1111-1111-111111111111",
    "emailAddress": "tester@example.com",
    "personalisation": {"first_name":"Alex"},
    "reference": "notify-email-001"
  }'
```

### Send SMS

```bash
curl -s -X POST http://localhost:3000/api/v1/notifications/sms \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "APPLICATION_ID",
    "templateId": "22222222-2222-2222-2222-222222222222",
    "phoneNumber": "+447700900000",
    "personalisation": {"code":"123456"},
    "reference": "notify-sms-001"
  }'
```

Expected status: `202 Accepted`.

## 6) Notify callback simulation

### Email callback

```bash
curl -s -X POST http://localhost:3000/api/v1/notify/callbacks/email \
  -H "Content-Type: application/json" \
  -d '{
    "id":"cb-email-001",
    "reference":"notify-email-001",
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

### SMS callback

```bash
curl -s -X POST http://localhost:3000/api/v1/notify/callbacks/sms \
  -H "Content-Type: application/json" \
  -d '{
    "id":"cb-sms-001",
    "reference":"notify-sms-001",
    "to":"+447700900000",
    "status":"delivered",
    "created_at":"2026-03-20T10:00:00.000Z",
    "completed_at":"2026-03-20T10:00:10.000Z",
    "sent_at":"2026-03-20T10:00:01.000Z",
    "notification_type":"sms",
    "template_id":"22222222-2222-2222-2222-222222222222",
    "template_version":1
  }'
```

Expected:

```json
{"received":true}
```

## 7) GOV.UK Pay webhook simulation

Endpoint:

```bash
POST /api/v1/pay/webhooks
```

Sample payload:

```json
{
  "payment_id": "pay_dummy_001",
  "payment_provider": "sandbox",
  "created_date": "2026-03-20T10:00:00.000Z",
  "event_date": "2026-03-20T10:05:00.000Z",
  "event_type": "payment_succeeded",
  "state": {
    "status": "success",
    "finished": true,
    "message": "Payment complete"
  },
  "resource_id": "res_001",
  "resource_type": "payment"
}
```

For real signature validation, compute `Pay-Signature` as HMAC-SHA256 of raw request body using `GOV_PAY_WEBHOOK_SECRET`.

Expected response from API:

```json
{"received":true}
```

## 8) One Login and JWKS

### JWKS

```bash
curl -s http://localhost:3000/.well-known/jwks.json
```

### Start auth flow

```bash
curl -i http://localhost:3000/api/v1/onelogin/start
```

Expected: redirect to One Login authorization URL.

## 9) Common errors and fixes

1. `zsh: command not found: #`
- Cause: comment line copied into terminal.
- Fix: run only command lines, not lines starting with `#`.

2. `applicationId Invalid uuid`
- Cause: sending placeholder text like `"<paste-application-id-here>"`.
- Fix: create application first and use the real UUID.

3. `P1010 User denied access on database`
- Cause: invalid `DATABASE_URL` username/password.
- Fix: use valid local Postgres user and DB.

4. `INTERNAL_ERROR` when creating payment
- Cause: external API auth issue (usually invalid GOV Pay key).
- Fix: replace with real GOV.UK Pay sandbox key.

5. `Invalid environment variables: Required`
- Cause: `.env` missing or not loaded.
- Fix: ensure `.env` exists and app starts with env loading enabled.

## 10) Minimal smoke test checklist

1. Health endpoint returns `status: ok`.
2. Application create returns `201` and UUID id.
3. Payment create validates request body.
4. Notify email endpoint accepts request (`202`) with valid key/template.
5. Notify callback endpoints return `{ "received": true }`.
6. JWKS endpoint returns `{ "keys": [...] }`.
