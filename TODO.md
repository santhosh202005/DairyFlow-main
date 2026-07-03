# DairyFlow - Milk Entry UI Refactor Plan

- [x] Refactor `src/components/MilkEntries.tsx` into month-wise journal UI (initial implementation)
  - [ ] Add month (Jan–Dec) and year selectors
  - [ ] Add search + filter + date picker controls at top
  - [ ] Add loading spinner and “No Entries Found” message
  - [ ] Add sorting (date/customer) + pagination
- [x] Group entries month-wise into rows with Morning/Evening/Total milk + totals footer

  - [ ] Implement responsive table: horizontal scroll on mobile, sticky header, card conversion on very small screens
  - [ ] Make “Add Entry” fixed top-right on desktop and sticky bottom on mobile (above bottom nav)
- [ ] (If needed) Update `src/index.css` with missing utility styles
- [ ] Run `npm run build` (or equivalent) and verify UI behavior on desktop + mobile breakpoints


