# TODO - DairyFlow

- [x] Resolve port conflicts (24678, 3000) during development restarts.
- [ ] Fix authentication/session verification infinite loading in React.
  - [ ] Ensure `setIsVerifying(false)` always executes.
  - [ ] If no token in localStorage -> redirect to `/login`.
  - [ ] If token invalid/expired -> clear localStorage + redirect to `/login`.
  - [ ] Add hard 10s timeout for backend/session API calls.
  - [ ] If backend unreachable -> show message "Server is starting, please wait a few seconds..." and then redirect to login.
  - [ ] Prevent infinite loops by guarding `useEffect` and verification logic.
  - [ ] Add console logs pinpointing failure reason.
  - [ ] Ensure refresh restores session without getting stuck.
  - [ ] Ensure works in localhost + Render.
- [ ] Run TypeScript check / lint and verify login/dashboard behavior.

