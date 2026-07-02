# Auth Fix Plan - DairyFlow

## Goal
Stop infinite "Verifying Session" loader and ensure correct redirect to `/login` when unauthenticated/invalid token/backend down.

## Files
- `src/App.tsx`
- `src/api.ts`
- (maybe) `src/auth.ts`

## Required changes
1. **Hard timeout (10s) for auth/session verification API calls**
   - Wrap `/api/health` + `/api/auth/me` verification in a single 10s promise race.

2. **Always call `setIsVerifying(false)`**
   - Ensure `finally` runs even for timeout and all error paths.

3. **No token in localStorage => redirect to login**
   - If `stored` is null or missing token, clear state, set `isVerifying=false`, and render `<Login />`.

4. **Invalid/expired token => clear localStorage and redirect**
   - On `/api/auth/me` failure, call `clearAuth()` and set auth state to `{token:null, role:null}`.

5. **Backend unavailable/sleeping => show message and then redirect**
   - If `/api/health` or verification fails (including timeout), set `errorMsg` to:
     "Server is starting, please wait a few seconds..."
   - After the timeout (or quickly), clear auth and render login.

6. **Prevent infinite loops**
   - Keep verification in a single `useEffect` with empty deps and guard with `didRun` ref.
   - Ensure no state updates re-trigger verification.

7. **Console logs for debugging**
   - Log: stored token presence, health result/timeout, auth/me result/timeout, and final decision.

## Implementation approach
- Add helpers in `src/App.tsx`:
  - `withHardTimeout<T>(promise, ms)`.
  - `redirectToLogin()` that clears auth and sets authData + isVerifying false.
- Update the current `checkServerAndSession` logic to:
  - Check token first.
  - Run `health` and `auth/me` under a 10s hard timeout.
  - On any failure: clear auth, set serverStatus/errorMsg, and render login.

## Verification
- Test cases:
  - Fresh load with no localStorage token -> login appears.
  - With valid token -> dashboard appears.
  - With invalid token -> localStorage cleared + login.
  - Backend sleeping/stopped -> show message and login after timeout.
  - Refresh with valid session -> dashboard restored without stuck loader.

