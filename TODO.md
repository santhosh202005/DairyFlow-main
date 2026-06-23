# TODO

- [x] Fix logout/state persistence: clear active page (activeView) immediately and prevent showing previous page on refresh when token is missing.
- [ ] Implement login state rehydration correctly (guard against stale authData and reset activeView to dashboard when no token).
- [ ] Remove any lingering UI state that can survive refresh (e.g., mobile nav active bg/layoutId issues if applicable).
- [ ] Test: login, navigate, refresh; verify that correct screen shows based on auth token only.
- [ ] Test logout + refresh; verify login page shown and previous app page not visible.

