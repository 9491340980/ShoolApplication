# VidyaSetu 🏫

**Simple, bilingual (తెలుగు + English) school management** for Head Masters, Teachers, Parents
and Students. Built to demo well and sell: one-click role logins, seeded realistic data, works on
desktop and installs on phones as an app (PWA).

## Quick start

```powershell
npm install
ng serve
```

Open http://localhost:4200 — click any of the four demo role buttons to enter instantly.

- **Demo accounts** (email/password form): `demo-hm@vidyasetu.app` / `demo1234`
  (also `demo-teacher@`, `demo-parent@`, `demo-student@`).
- **Language toggle**: EN / తెలుగు button in the top bar (and on the login screen).
- **Demo mode**: with no Firebase config, all data is seeded locally and persists in the browser.
  Changes you make (attendance, marks, fees, notices) survive reloads. Clear site data to reset.

## Features

| Module | Head Master | Teacher | Parent | Student |
|---|---|---|---|---|
| Dashboard | stats + chart | stats + chart | child overview | my overview |
| Notices | post + read | post + read | read | read |
| Students | full list | my class | — | — |
| Attendance | mark any class | mark my class | view child's | view mine |
| Marks | enter any class | enter my class | result card | result card |
| Fees | collection dashboard | — | fee details | fee details |
| Timetable | all classes | my classes | child's class | my class |
| Teachers | list | — | — | — |

## Tech stack

- **Angular 21** — standalone components, signals, lazy routes
- **Tailwind CSS 4** — design tokens in [src/styles.css](src/styles.css)
- **Firebase (optional)** — Auth + Firestore + Hosting; see [FIREBASE-SETUP.md](FIREBASE-SETUP.md)
- **PWA** — installable on Android/iOS home screen, offline shell

## Going live

Follow [FIREBASE-SETUP.md](FIREBASE-SETUP.md) to connect Firebase Auth/Firestore and deploy to a
free `https://<project>.web.app` URL you can share with clients.

## Build

```powershell
ng build   # output in dist/vidyasetu
```
