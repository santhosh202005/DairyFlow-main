# TODO

- [ ] Update PWA/service worker handling to prevent stale old frontend bundle
  - [ ] Add versioned SW caching logic in `src/main.tsx` (register `/sw.js?v=...` or unregister+refresh)
  - [ ] Ensure production build invalidates SW by changing registration version
- [ ] Test flow end-to-end
  - [ ] Hard reload / clear site data
  - [ ] Login using new username/password
  - [ ] Verify Settings page loads

