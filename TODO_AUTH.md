# TODO - Auth/Session Fix Progress

- [ ] Refactor `src/App.tsx` session verification to include hard 10s timeout.
- [ ] Ensure `setIsVerifying(false)` always runs.
- [ ] Redirect to Login when token missing.
- [ ] Clear localStorage + redirect when token invalid.
- [ ] Show server-starting message and then redirect when backend unavailable.
- [ ] Add console logs for each decision path.
- [ ] Run `npm run lint` and `npm run dev` smoke test.

