# Before-Pilot Smoke Checklist

Complete these checks before inviting the 5-person pilot group. Do not mark the alpha as pilot-ready until all required checks pass in the deployed environment.

1. [ ] Deployed API `/health` returns 200.
2. [ ] Deployed API `/health/readiness` returns database-ready 200.
3. [ ] `pnpm smoke:alpha` passes against the deployed API and app origins.
4. [ ] Vercel app loads the home route with HTTP 200.
5. [ ] Vercel `/login` loads with HTTP 200.
6. [ ] Vercel `/virtual-office` route loads with HTTP 200.
7. [ ] Vercel `/platform-admin` route loads with HTTP 200 or the expected blocked UI.
8. [ ] Cognito Hosted UI domain opens from the deployed login page.
9. [ ] Cognito callback URL points to the active Vercel `/login/callback` URL.
10. [ ] Cognito logout URL points to the active Vercel `/login` URL.
11. [ ] Render `WORKMAP_ALLOWED_ORIGINS` includes the exact active Vercel origin.
12. [ ] Render `WORKMAP_APP_URL` matches the active Vercel origin for invite link generation.
13. [ ] Supabase has all required Prisma migrations applied.
14. [ ] Owner can sign in with Cognito.
15. [ ] New Owner can create a workspace.
16. [ ] Owner completes display name and avatar/profile setup.
17. [ ] Owner can open `/virtual-office` and move away from spawn.
18. [ ] Owner can open `/onboarding/invite`.
19. [ ] Owner can create an Employee invite.
20. [ ] Employee can sign in/sign up with Cognito using the invited verified email.
21. [ ] Employee invite acceptance succeeds with the matching email.
22. [ ] Wrong-email invite acceptance fails safely.
23. [ ] Employee completes compliance, avatar/profile, and device setup flow.
24. [ ] Owner and Employee see each other in `/virtual-office`.
25. [ ] Two-user realtime movement works in both directions, with polling fallback still safe.
26. [ ] People panel and contact drawer show readable names, avatars, status, and no raw UUID room labels.
27. [ ] Employee can view own-scope reports after sample activity exists.
28. [ ] Owner can view company aggregate reports after sample activity exists.
29. [ ] Employee direct company-scope report request is blocked with 403.
30. [ ] Platform Admin sees only privacy-safe tenant metadata and tenant users are blocked from platform APIs.
