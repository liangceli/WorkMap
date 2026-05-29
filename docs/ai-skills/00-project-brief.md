# WorkMap Project Brief

## Product

WorkMap is a 2D virtual office and compliant work visibility platform for hybrid teams.

A company signs up, creates a virtual 2D office, invites employees, and installs a desktop agent + browser extension on company devices.

Employees appear as avatars in a 2D office. Managers can view presence, active time, app usage, and website domain usage. Employees can contact each other through Teams, Outlook, 3CX, or internal quick messages.

## Core modules

1. Web App
   - Next.js frontend
   - 2D virtual office using Phaser
   - employee dashboard
   - manager dashboard
   - admin/compliance settings

2. Backend API
   - NestJS
   - PostgreSQL
   - Prisma
   - Redis
   - BullMQ
   - Socket.IO Gateway

3. Desktop Agent
   - Electron MVP
   - app usage detection
   - idle detection
   - local cache
   - heartbeat
   - browser extension bridge

4. Browser Extension
   - Chrome/Edge Manifest V3
   - active tab domain tracking
   - no full URL by default
   - sends domain event to Desktop Agent

5. Worker
   - aggregates raw events into daily summaries
   - app usage summary
   - website usage summary

6. Integrations
   - Teams deep link
   - Outlook mailto or compose link
   - 3CX web client / click-to-call

## Privacy principles

WorkMap must be transparent, compliant, and minimal.

Default collection:

- app name
- browser domain
- active/idle state
- device heartbeat
- work session timestamps

Do not collect:

- keystrokes
- screen images
- microphone
- camera
- Teams message content
- email content
- full URLs by default
- form inputs
- passwords

## MVP target

MVP should support:

- company registration
- employee login
- 2D office
- avatar movement
- realtime presence
- desktop agent app tracking
- Chrome/Edge domain tracking
- manager dashboard
- employee self dashboard
- contact actions: Teams / Outlook / 3CX
- monitoring policy acknowledgement

## Initial architecture

Monorepo:

- apps/web
- apps/api
- apps/desktop-agent
- apps/browser-extension
- apps/worker
- packages/shared-types
- packages/ui
- packages/domain-utils
- prisma
- docs

## Director control

The Director chat owns:

- architecture
- database schema
- API contract
- privacy rules
- security model
- module boundaries
- integration strategy

Other AI workers must not change these without approval.