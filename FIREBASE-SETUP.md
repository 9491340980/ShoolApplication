# Firebase Setup (when you're ready to go live)

The app currently runs in **offline demo mode** — all data is seeded locally and saved in the
browser (localStorage). That is perfect for client demos: it works instantly, even with no internet.

When you sign a client and need real multi-user data, connect Firebase (free Spark plan is enough
to start):

## 1. Create the Firebase project

1. Go to https://console.firebase.google.com and click **Add project**.
2. Name it `vidyasetu` (or the school's name). Disable Google Analytics (not needed).
3. In the left menu open **Build → Authentication → Get started** and enable
   **Email/Password** as a sign-in method.
4. Open **Build → Firestore Database → Create database** → choose **asia-south1 (Mumbai)** →
   start in **production mode**.

## 2. Get the web config

1. Project settings (gear icon) → **Your apps** → click the **</>** (web) icon.
2. Register the app as `vidyasetu-web`. Copy the `firebaseConfig` object it shows.
3. Paste the values into [src/environments/environment.ts](src/environments/environment.ts).
   As soon as `apiKey` is non-empty, the app switches from demo mode to Firebase.

## 3. Create the demo/login accounts

In **Authentication → Users → Add user**, create:

| Email | Password | Role |
|---|---|---|
| demo-hm@vidyasetu.app | demo1234 | Head Master |
| demo-teacher@vidyasetu.app | demo1234 | Teacher |
| demo-parent@vidyasetu.app | demo1234 | Parent |
| demo-student@vidyasetu.app | demo1234 | Student |

(Use stronger passwords for a real school's accounts.)

## 4. Firestore collections

The local store in [src/app/core/data.service.ts](src/app/core/data.service.ts) mirrors the
planned Firestore layout one-to-one, so migrating is mechanical:

| Collection | Doc id | Contents |
|---|---|---|
| `users` | auth uid | role, name, phone, studentId/classId |
| `students` | student id | roll, name, classId, parentPhone, feeStatus |
| `teachers` | teacher id | name, subjects, classes, phone |
| `attendance` | `{classId}_{date}` | statuses map (studentId → present/absent) |
| `marks` | `{classId}_{examId}_{subject}` | scores map (studentId → score) |
| `fees` | fee id | studentId, label, amount, dueDate, status |
| `notices` | notice id | title, body, type, audience, postedBy, date |
| `timetables` | classId | periods, grid |

## 5. Security rules (starting point)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function role() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }
    match /{document=**} {
      allow read: if request.auth != null;
    }
    match /attendance/{doc} { allow write: if role() in ['headmaster', 'teacher']; }
    match /marks/{doc}      { allow write: if role() in ['headmaster', 'teacher']; }
    match /notices/{doc}    { allow write: if role() in ['headmaster', 'teacher']; }
    match /fees/{doc}       { allow write: if role() == 'headmaster'; }
    match /students/{doc}   { allow write: if role() == 'headmaster'; }
    match /teachers/{doc}   { allow write: if role() == 'headmaster'; }
    match /users/{uid}      { allow write: if request.auth.uid == uid || role() == 'headmaster'; }
  }
}
```

## 6. Hosting (free shareable demo URL)

```powershell
npm install -g firebase-tools
firebase login
firebase init hosting   # public dir: dist/vidyasetu/browser, single-page app: yes
ng build
firebase deploy
```

You get an `https://<project>.web.app` URL you can open on any phone or send to any client.
