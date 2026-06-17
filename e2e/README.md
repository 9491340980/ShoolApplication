# End-to-end tests (Playwright)

Automated tests for VidyaSetu. **Local + git only — they never deploy.**
`firebase deploy` only uploads `dist/`, and nothing here is compiled into the
app, so these tests physically cannot ship to production.

## How it runs

Tests drive the app in **offline demo mode** (the `demo` build config turns
Firebase off, so the app boots on the built-in localStorage seed):

- deterministic — same seeded data every run
- no network, no credentials, no Firebase project touched
- each test gets a fresh browser context → isolated state

Playwright starts the demo server automatically (`npm run start:demo` on
port 4300); you don't need to start anything yourself.

## Commands

```bash
npm run test:e2e          # run all tests headless
npm run test:e2e:ui       # interactive runner (watch, time-travel)
npm run test:e2e:report   # open the last HTML report

# Run a subset:
npx playwright test smoke
npx playwright test e2e/tests/fees.spec.ts

# Run against a deployed URL instead of the local demo server:
E2E_BASE_URL=https://vidyasetu-d0ee7.web.app npm run test:e2e
```

First run only: `npx playwright install chromium` (downloads the browser).

## Layout

```
e2e/
  fixtures/app.ts     login helpers + shared utilities
  tests/
    auth.spec.ts      login per role, password login, bad password
    smoke.spec.ts     every role → every sidebar page loads without crashing
    attendance.spec.ts mark all-present and save
    fees.spec.ts      set total → collect installment → balance correct
```

## Adding a test

1. Create `e2e/tests/<feature>.spec.ts`.
2. `import { loginAs, gotoPage } from '../fixtures/app';`
3. `await loginAs(page, 'headmaster');` then drive the UI and `expect(...)`.

Prefer role-based / text selectors (`getByRole`, `getByText`) and route hrefs
(`aside a[href="/fees"]`) — they survive styling changes.

## Coverage roadmap

- [x] Smoke: all roles × all pages
- [x] Auth flows
- [x] Attendance marking
- [x] Fee installments
- [ ] Promotion (plan preview, merge warning, no roll clash)
- [ ] Notices / homework send queue
- [ ] Parent share link (`/p/:token`)
- [ ] Marks entry + report card
- [ ] Firestore security rules (separate emulator suite)
