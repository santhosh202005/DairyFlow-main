# TODO

- [ ] Remove Firebase related files (firebase config + functions) if needed
- [x] Stop Firebase backend usage (run only `npm run start` using SQLite server)
- [ ] Update package.json scripts/docs to use only root server.ts (SQLite)
- [ ] Remove Firebase config files: firebase.json, .firebaserc, firestore.rules, firestore.indexes.json (or archive them)
- [ ] Remove functions/ directory or at least remove from repo/build/deploy paths
- [ ] Verify frontend still calls the same API routes (`/api/...`)
- [x] Verify `npm run build` and `npm run start` work without firebase

# Mobile / Play Store release
- [ ] Make UI mobile-first: compact layout, hide sidebar on small screens
- [ ] Add bottom navigation for mobile
- [ ] Add viewport meta + app icons (already partially via index.html)
- [ ] Generate Android build (Capacitor or Play-ready APK) OR document TWA process
- [ ] Prepare Play Store listing artifacts (app bundle, screenshots, privacy policy links)

