# Technical Flow Code Guide

This document explains the technical implementation for payment callback, reconciliation fallback, and Notify callback handling.

## 1) Architecture Overview

Main runtime sequence:
1. API receives payment requests
2. Payment provider handles checkout
3. Provider webhook enters backend
4. Webhook events are persisted and processed asynchronously
5. Reconcile endpoint can recover missed webhook states
6. Notify send endpoints create and dispatch notifications
7. Notify callback endpoints update delivery outcomes

## 2) Key Modules And Responsibilities

## Application bootstrap
- File: src/server.ts
- Responsibilities:
  1. Load environment variables
  2. Start HTTP server
  3. Start webhook poller every 10 seconds

## HTTP route wiring
- File: src/app.ts
- Responsibilities:
  1. Apply request logger
  2. Capture raw body for /api/v1/pay/webhooks before JSON parser
  3. Register payment, webhook, notify, callback routes
  4. Handle 404 and global errors

## Payment APIs
- File: src/modules/payments/payment.controller.ts
- Routes:
  1. POST /api/v1/applications
  2. POST /api/v1/payments
  3. GET /api/v1/payments/:id
  4. GET /api/v1/payments/:id/status

## Payment orchestration
- File: src/modules/payments/payment.service.ts
- Responsibilities:
  1. createPayment: validate application, call provider, store payment, return redirect URL
  2. getPaymentStatus: fetch local payment state
  3. reconcilePayment: fetch provider status, validate transition, update local status, save event

## Webhook ingest and async processing
- File: src/modules/pay-webhooks/payWebhook.service.ts
- Responsibilities:
  1. Verify Pay-Signature using raw body and secret
  2. Persist webhook event idempotently
  3. Poll and process pending events
  4. Query provider for latest status
  5. Apply valid status transitions only

## Signature verification
- File: src/modules/pay-webhooks/paySignature.service.ts
- Technique:
  1. HMAC SHA-256 over raw body
  2. Compare with timingSafeEqual

## Status transition domain rules
- File: src/modules/payments/payment.domain.ts
- Responsibilities:
  1. Map provider statuses to local enum
  2. Restrict status transitions to allowed lifecycle
  3. Mark terminal statuses

## Notify send APIs
- Files:
  1. src/modules/notify/notify.controller.ts
  2. src/modules/notify/notify.service.ts
  3. src/modules/notify/notify.client.ts
- Responsibilities:
  1. Validate request
  2. Save notification as PENDING
  3. Call GOV.UK Notify
  4. Update notification status to SENT or FAILED

## Notify callback handling
- Files:
  1. src/modules/notify-callback/notifyCallback.controller.ts
  2. src/modules/notify-callback/notifyCallback.service.ts
  3. src/modules/notify-callback/notifyCallback.repository.ts
  4. src/modules/notify-callback/notifyCallback.domain.ts
- Responsibilities:
  1. Validate callback payload
  2. Map callback status to internal event and status
  3. Save notification event
  4. Update notification status by notifyNotificationId

## 3) Data Model And Tables

Defined in prisma/schema.prisma.

Primary entities:
1. applications
2. payments
3. payment_events
4. webhook_events
5. notifications
6. notification_events

Important relationships:
1. one application -> many payments
2. one application -> many notifications
3. one payment -> many payment_events
4. one payment -> many webhook_events
5. one notification -> many notification_events

## 4) State And Transition Behavior

## Payment states
1. CREATED
2. IN_PROGRESS
3. SUCCEEDED
4. FAILED
5. CANCELLED
6. ERROR

Allowed transition design prevents out-of-order corruption.
Invalid transitions are skipped and logged.

## Notification states
1. PENDING
2. SENT
3. DELIVERED
4. FAILED
5. PERMANENT_FAILURE
6. TECHNICAL_FAILURE

Notify callback controls final delivery states.

## 5) Reliability Patterns

1. Webhook events are persisted first, processed later
2. Processing status tracks PENDING, PROCESSING, PROCESSED, FAILED
3. Idempotent external event key avoids duplicate webhook insertion
4. Fallback reconcile endpoint recovers missed webhook delivery
5. Terminal state checks avoid re-processing final records

## 6) Security And Validation

1. Webhook signature validation on raw body
2. Zod validation on request and callback payloads
3. Global error handler returns structured error objects
4. Strict env validation on startup

## 7) Known Gap To Implement

Current gap:
1. Payment success does not automatically trigger notifyService.sendEmail or notifyService.sendSms.

Current behavior:
1. Payment success path and Notify path are both implemented.
2. Orchestration between them is manual via notify endpoints.

Recommended enhancement:
1. On transition to SUCCEEDED in webhook/reconcile flow, trigger notification send service with an idempotency guard.

## 8) Suggested Sequence For New Developers

1. Read src/app.ts for route topology
2. Read payment.controller and payment.service
3. Read payWebhook.service and payment.domain
4. Read notify.service and notifyCallback.service
5. Inspect prisma/schema.prisma for persistence model
6. Execute FLOW_EXECUTION_TEST_PLAN.md end-to-end
