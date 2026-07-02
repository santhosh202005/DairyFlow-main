# TODO: Fix “old version still showing” (PWA cache)

1. Update `src/main.tsx`
   - Add cache-busting to service worker registration (version querystring)
   - Unregister old service worker on version mismatch
2. Rebuild/redeploy
   - Run local dev build and hard reload (Ctrl+F5)
   - If production, redeploy the backend/frontend
3. Validate
   - Login screen shows username/password (not old OTP login)
   - Settings page loads

