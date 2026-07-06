# Activity Monitoring Compliance Skill

## Status And Timing

This document is the durable product framework for WorkMap activity monitoring.

- Keep the monitoring capability in the product.
- Do not let this framework interrupt the current core-feature completion work.
- Implement and legally review these controls before broad production monitoring.
- Treat this as product and engineering guidance, not legal advice or a claim of zero legal risk.

## Product Position

WorkMap provides privacy-minimised computer activity telemetry. It does not determine:

- hours worked;
- employee productivity;
- misconduct;
- whether an employee should receive a warning; or
- whether employment should be terminated.

Employment decisions belong to the employer. WorkMap reports must remain factual, explain their limitations, and must not provide automated disciplinary or termination recommendations.

## Allowed Collection

Collection is allowlist-based. The intended production scope is limited to:

- foreground application name and active duration;
- browser hostname/domain and active duration;
- Agent start, stop, pause, resume, heartbeat, and version metadata;
- company, user, and company-managed device identifiers required for tenant isolation;
- server receipt time and bounded client timestamps required for aggregation and audit.

Rules:

- Minimized and background applications do not count as active use.
- Application sessions shorter than five seconds do not contribute usage duration.
- Application identity must not include document names, window titles, message subjects, or content.
- Browser collection stops at the normalized hostname. Never collect the full URL, path, query, fragment, page title, or page content.
- A sensitive-domain filter should run on the device so excluded domains are never uploaded.

## Permanently Prohibited Collection

WorkMap must not collect:

- screenshots or screen recordings;
- keystrokes or typed text;
- mouse movement or click content;
- clipboard content;
- webcam, camera, microphone, or call audio;
- private message, chat, or email bodies;
- email subjects or document titles;
- webpage bodies, form inputs, or passwords;
- full browsing URLs, paths, query parameters, or fragments; or
- hidden background content unrelated to the allowed foreground activity summary.

Adding any prohibited category requires an explicit new product decision, legal review, threat review, user approval, and a separate implementation round. It must never arrive as incidental telemetry.

## Device Boundary

- Monitoring is for company-managed computers only.
- The employer must attest that it owns or manages a device before pairing is enabled.
- WorkMap must not present that attestation as independent proof of ownership.
- Personal-device monitoring is disabled by default and is outside the approved product scope.
- Device credentials must remain user-, company-, client-, and device-bound and revocable.

## Notice And Acknowledgement

Monitoring must not begin until the employee has received and acknowledged the active policy version.

The notice must clearly state:

- the exact data collected and not collected;
- the purpose of collection;
- the monitoring schedule and employee time zone;
- who can access personal and aggregate reports;
- the retention and deletion rules;
- the employee's view, correction, pause, stop, and complaint options;
- the identity of relevant service providers and overseas processing locations; and
- that the employer may use the data in workplace management processes, while WorkMap does not make employment decisions.

Store the policy version, acknowledgement time, user, company, and effective date. Material policy changes require a new version and renewed acknowledgement.

An acknowledgement button is not a substitute for applicable workplace-surveillance, consultation, privacy, employment, award, agreement, or state and territory requirements. The employer remains responsible for satisfying those requirements before enabling monitoring.

## Employee Visibility And Control

- The Agent is visible while installed and while monitoring is active.
- The Agent shows collecting, paused, outside-hours, offline, and error states.
- The employee can pause or stop the Agent.
- The employee can see their own collected summaries and current policy.
- Provide a correction or dispute path for inaccurate device assignment or activity data.
- Stopping the Agent creates a neutral technical record. It must not automatically be labelled as misconduct or time theft.
- Distinguish user stop, normal shutdown, operating-system shutdown, crash, network loss, credential revocation, and unknown interruption when evidence supports the distinction.

## Work Schedule Enforcement

The current intended default schedule is 09:00 to 17:00 in the employee's work-location time zone.

- Enforce the schedule on the device before collection, not only during server reporting.
- Do not collect or queue activity before the start time or after the end time.
- Split or close an active interval exactly at the schedule boundary.
- Handle daylight-saving changes correctly.
- Support approved part-time, shift, holiday, and location-specific schedules before claiming broad workforce support.
- A material schedule change updates the policy and may require renewed employee acknowledgement.

## Reports And Employment Decisions

Approved report language includes:

- `Recorded foreground application activity`;
- `Recorded active domain duration`;
- `Agent unavailable` or a more specific supported technical state; and
- `No recorded activity does not prove that no work occurred.`

Prohibited report language includes:

- `hours worked` when derived only from computer telemetry;
- `employee was not working`;
- `low-performing employee`;
- `time theft` without an external employer process; and
- recommendations to warn, discipline, or terminate.

Reports should explain that meetings, calls, offline work, reading, travel, breaks, and other legitimate work may not appear in foreground application data.

The employer owns any decision to use WorkMap data in a performance, investigation, disciplinary, or termination process. Product terms should say that WorkMap supplies telemetry and not employment or legal advice. Contract language cannot remove statutory obligations or protect WorkMap from its own misleading claims, security failures, or inaccurate processing.

## Access Boundaries

- Employees may access only their own activity summaries.
- Authorized Owner or approved manager roles may access company aggregates and permitted individual reports.
- Every access to another employee's individual report is audit logged.
- Cross-tenant access is always rejected.
- Platform Admin does not receive employee-level app or domain activity by default.
- Support access requires a documented purpose, least privilege, time bounds, and an audit record.

## Data Governance And Security

- Collect the minimum data needed for the approved purpose.
- Encrypt data in transit and at rest.
- Enforce tenant isolation and role-based access on the backend, not only in the UI.
- Never use employee activity for advertising, unrelated analytics, or AI/model training.
- Use a documented retention schedule. Ninety days is the current product-policy baseline, subject to jurisdiction and legal review.
- Delete or de-identify data when it is no longer required, except for a documented lawful hold.
- Maintain incident response and eligible data-breach assessment procedures.
- Document processors, subprocessors, hosting regions, overseas disclosures, deletion behavior, and breach-notification terms.
- Protect API credentials and device credentials with rotation and revocation support.

## Accuracy And Evidence Integrity

- Keep device identity, Agent version, server receipt time, event identity, and aggregation version with report provenance.
- Use idempotent ingestion so retries do not inflate durations.
- Record known gaps and Agent interruptions without inferring intent.
- Clearly separate captured facts from inferred or categorized values.
- Preserve an audit trail for policy changes, device pairing/revocation, report access, corrections, and exports.
- Test minimized/background exclusion, the five-second threshold, lock/idle transitions, schedule boundaries, shutdown flush, offline retry, duplicate rejection, and time-zone changes.

## External And Contract Requirements

Before broad production use, require:

- Australian employment and privacy lawyer review for the intended jurisdictions;
- customer Terms of Service and a Data Processing Agreement;
- a customer workplace-monitoring policy and employee notice;
- a privacy impact assessment;
- customer warranties that monitoring is authorized and limited to company-managed devices;
- clear allocation of employer decisions to the customer;
- proportionate liability, indemnity, cyber-security, and breach terms reviewed by counsel; and
- review of each employee's actual work jurisdiction, including remote and interstate workers.

Official starting references:

- Fair Work Ombudsman workplace privacy guide: https://www.fairwork.gov.au/tools-and-resources/best-practice-guides/workplace-privacy
- Fair Work Ombudsman unfair dismissal guide: https://www.fairwork.gov.au/ending-employment/unfair-dismissal
- OAIC APP 11 security guidance: https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-11-app-11-security-of-personal-information
- OAIC Notifiable Data Breaches: https://www.oaic.gov.au/privacy/notifiable-data-breaches

These references must be rechecked when implementation resumes because laws and regulator guidance can change.

## Deferred Implementation Sequence

After current core product functionality is complete:

1. Obtain jurisdiction-specific legal review and convert the result into testable requirements.
2. Add versioned employer policy configuration and employee acknowledgement gating.
3. Enforce company-device attestation, visible Agent state, employee pause/stop, and local work schedules.
4. Add sensitive-domain filtering, employee data access/correction, retention, deletion, and Owner access auditing.
5. Rewrite report labels and exports around factual telemetry and explicit limitations.
6. Complete security, tenant-boundary, interruption, schedule, ingestion, and report regression tests.
7. Run a controlled pilot before any broad release or employment-decision use.

## Release Gate

Do not describe monitoring as broadly production-ready until all of the following are true:

- legal review is complete for the pilot jurisdictions;
- employee notice and acknowledgement occur before collection;
- company-device and schedule enforcement are implemented;
- prohibited collection scans and tests pass;
- employee visibility, pause/stop, own-data access, and correction paths work;
- Owner access auditing and Platform Admin exclusion are verified;
- retention, deletion, encryption, breach response, and processor contracts are in place;
- reports avoid work-hours, productivity, misconduct, and termination conclusions; and
- separate-computer end-to-end Agent, API, database, and report QA passes.
