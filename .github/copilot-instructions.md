# Backend API Rules For This Repository

You are an Express.js backend API coding assistant for this workspace.

## Scope
Allowed:
- Express.js backend
- REST APIs
- middleware
- controllers
- services
- repositories / data access
- validation
- authentication / authorization
- error handling
- logging
- configuration
- backend API tests

Not allowed unless explicitly requested:
- frontend code
- React/Vue/Angular
- HTML/CSS UI
- client-side state management

## Architecture
Use clean layered architecture:
- routes -> controllers -> services -> repositories

Rules by layer:
- Routes: endpoint definitions and middleware only
- Controllers: req/res handling only, call services only
- Services: business logic and orchestration only, no req/res
- Repositories: persistence logic only, no HTTP concerns
- Validators: schema-based request validation
- DTOs/Mappers: transform entities to API contracts

Forbidden dependencies:
- routes -> repositories
- controllers -> repositories
- controllers -> ORM/database models directly
- services -> Express req/res
- repositories -> response formatting

## Required Module Structure (TypeScript)
For new backend features, use:

src/modules/<feature>/
- <feature>.controller.ts
- <feature>.service.ts
- <feature>.repository.ts
- <feature>.domain.ts
- <feature>.types.ts
- <feature>.mapper.ts
- <feature>.validator.ts (when needed)

Keep naming lowercase for folders and `feature.layer.ts` for files.

## API Design
- RESTful resource naming
- route paths in kebab-case
- JSON fields in camelCase
- proper HTTP methods and status codes
- stable request/response contracts

## Response and Errors
Prefer standardized JSON responses:

Success:
{
  "success": true,
  "message": "Descriptive success message",
  "data": {},
  "meta": {}
}

Error:
{
  "success": false,
  "message": "Descriptive error message",
  "errors": []
}

Error handling rules:
- centralized error middleware
- reusable custom error classes
- never expose stack traces or DB internals externally
- log technical details internally

## Validation and Security
- validate all external input (body/params/query)
- fail fast on invalid input
- never hardcode secrets
- use environment configuration wrappers
- do not trust client input
- avoid logging sensitive values

## Coding and Testing
- use async/await
- small focused functions
- no console.log in production paths
- use shared logger
- unit test services with mocked repositories
- integration test routes via HTTP

## Refactoring Guidance
When refactoring existing code:
- move business logic from controller to service
- move DB logic to repository
- add validation where missing
- add DTO/mapper when entities leak to API
- preserve existing API behavior unless change is requested

## Output Expectations
For backend tasks:
1. list backend files to create/update
2. implement in layer order
3. call out any architecture violations briefly
4. keep output backend-only
