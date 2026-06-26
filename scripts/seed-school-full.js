/**
 * Fill a real school (found by its admin email) with dummy data for EVERY module:
 * students, teachers + login accounts, class-teacher assignments, a month of
 * class & teacher attendance, marks, fees with installment history, notices,
 * homework, subjects and timetables. Idempotent (re-runs overwrite cleanly).
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/seed-school-full.js oxfordgrammarschool009@gmail.com
 */
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: 'vidyasetu-d0ee7' });
const db = admin.firestore();
const auth = admin.auth();

const ADMIN_EMAIL = (process.argv[2] || 'oxfordgrammarschool009@gmail.com').toLowerCase();
const PASSWORD = 'demo123';
const CLASSES = ['6A', '7A', '8A', '8B', '9A', '9B', '10A', '10B'];
const SUBJECTS = ['Telugu', 'English', 'Maths', 'Science', 'Social', 'Hindi'];
const today = new Date().toISOString().slice(0, 10);
const ym = today.slice(0, 7);

const FIRST = ['Aarav', 'Sai', 'Priya', 'Kavya', 'Rohan', 'Ananya', 'Vikram', 'Sneha', 'Arjun', 'Divya',
  'Karthik', 'Meera', 'Nikhil', 'Pooja', 'Rahul', 'Sruthi', 'Tarun', 'Lavanya', 'Manish', 'Keerthi',
  'Aditya', 'Bhavana', 'Charan', 'Deepthi', 'Eshwar', 'Harika', 'Naveen', 'Sahithi', 'Yashwanth', 'Ramya'];
const LAST = ['Reddy', 'Rao', 'Sharma', 'Nair', 'Verma', 'Kumar', 'Iyer', 'Patel', 'Naidu', 'Goud', 'Chowdary', 'Varma'];
const CASTES = ['OC', 'BC-A', 'BC-B', 'BC-D', 'SC', 'ST'];
const TONGUES = ['Telugu', 'Telugu', 'Telugu', 'Hindi', 'Tamil', 'Urdu'];
const TEACHER_NAMES = [
  'Sunitha Devi', 'Ravi Shankar', 'Padmaja Rao', 'Kishore Kumar', 'Anitha Rani',
  'Venkata Subbaiah', 'Lakshmi Narayana', 'Sridevi', 'Mohan Rao', 'Geetha Kumari',
  'Prasad Babu', 'Vani Sree', 'Naresh Chandra', 'Bhargavi', 'Ramesh Yadav'];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24) || 'fee';
const emailTag = ADMIN_EMAIL.split('@')[0].replace(/[^a-z0-9]/g, '').slice(0, 10) || 'school';

async function upsertAuthUser(email, displayName) {
  try {
    return (await auth.createUser({ email, password: PASSWORD, displayName })).uid;
  } catch (e) {
    if (e.code === 'auth/email-already-exists') {
      const u = await auth.getUserByEmail(email);
      await auth.updateUser(u.uid, { password: PASSWORD, displayName });
      return u.uid;
    }
    throw e;
  }
}

async function main() {
  const snap = await db.collection('schools').get();
  const school = snap.docs.map((d) => ({ id: d.id, ...d.data() })).find((s) => (s.adminEmail || '').toLowerCase() === ADMIN_EMAIL);
  if (!school) {
    console.log('No school with admin email', ADMIN_EMAIL);
    return;
  }
  const SID = school.id;
  console.log(`\nSeeding ALL modules into: ${school.name} [${SID}]  (${today})\n`);

  // subjects master
  await db.collection('subjects').doc(`${SID}_list`).set({ schoolId: SID, names: SUBJECTS });

  // ---- students: 10 per class ----
  const byClass = {};
  let count = 0;
  for (let c = 0; c < CLASSES.length; c++) {
    const classId = CLASSES[c];
    byClass[classId] = [];
    for (let r = 1; r <= 10; r++) {
      const idx = c * 10 + r;
      const id = `${SID}_st_${classId}_${String(r).padStart(2, '0')}`;
      const name = `${FIRST[idx % FIRST.length]} ${LAST[(c * 3 + r) % LAST.length]}`;
      await db.collection('students').doc(id).set({
        schoolId: SID, roll: String(r), name, classId,
        parentPhone: `98765${String(10000 + idx).slice(-5)}`,
        fatherName: `${LAST[(c + r) % LAST.length]} (Father)`,
        motherName: `${FIRST[(idx + 5) % FIRST.length]} (Mother)`,
        caste: CASTES[idx % CASTES.length], motherTongue: TONGUES[idx % TONGUES.length],
        admissionNo: `ADM${2000 + idx}`,
      });
      byClass[classId].push({ id, roll: r });
      count++;
    }
  }
  console.log(`✓ ${count} students`);

  // ---- teachers + login accounts + class-teacher assignments ----
  const creds = [];
  const teacherUserIds = [];
  for (let i = 0; i < TEACHER_NAMES.length; i++) {
    const name = TEACHER_NAMES[i];
    const tid = `${SID}_t${String(i + 1).padStart(2, '0')}`;
    const email = `teacher${String(i + 1).padStart(2, '0')}@${emailTag}.test`;
    const classTeacherOf = i < CLASSES.length ? CLASSES[i] : null;
    const uid = await upsertAuthUser(email, name);
    teacherUserIds.push(uid);
    await db.collection('teachers').doc(tid).set({
      schoolId: SID, name,
      subjects: [SUBJECTS[i % SUBJECTS.length], SUBJECTS[(i + 2) % SUBJECTS.length]],
      classes: classTeacherOf ? [classTeacherOf] : [],
      experienceYears: 4 + (i % 15), phone: `98760${String(10000 + i).slice(-5)}`, active: true,
    });
    await db.collection('users').doc(uid).set({
      role: 'teacher', name, email, phone: `98760${String(10000 + i).slice(-5)}`,
      schoolId: SID, classId: classTeacherOf, studentId: null,
    });
    if (classTeacherOf) {
      await db.collection('assignments').doc(`${SID}_${classTeacherOf}`).set({ schoolId: SID, classId: classTeacherOf, teacherId: uid, teacherName: name });
    }
    creds.push(`TEACHER  ${name.padEnd(18)} ${email}  /  ${PASSWORD}${classTeacherOf ? '  (class teacher ' + classTeacherOf + ')' : ''}`);
  }
  console.log(`✓ ${TEACHER_NAMES.length} teachers (+ logins, 8 class teachers)`);

  // ---- one parent per class (linked to roll 1) ----
  for (const classId of CLASSES) {
    const child = byClass[classId][0];
    const email = `parent_${classId.toLowerCase()}@${emailTag}.test`;
    const name = `Parent of ${classId} Roll 1`;
    const uid = await upsertAuthUser(email, name);
    await db.collection('users').doc(uid).set({
      role: 'parent', name, email, phone: `98759${classId.replace(/\D/g, '').padStart(5, '0')}`,
      schoolId: SID, studentId: child.id, classId: null,
    });
    creds.push(`PARENT   ${('Class ' + classId).padEnd(18)} ${email}  /  ${PASSWORD}`);
  }
  console.log(`✓ ${CLASSES.length} parents`);

  // recent school days (skip Sundays), newest first
  const days = [];
  for (let d = new Date(today + 'T00:00:00Z'); days.length < 22; d.setUTCDate(d.getUTCDate() - 1)) {
    if (d.getUTCDay() !== 0) days.push(d.toISOString().slice(0, 10));
  }

  // ---- class + teacher attendance across those days ----
  for (const date of days) {
    const seed = Number(date.slice(8, 10));
    for (const classId of CLASSES) {
      const statuses = {};
      byClass[classId].forEach((s, i) => (statuses[s.id] = (i + seed) % 8 === 3 ? 'absent' : 'present'));
      await db.collection('attendance').doc(`${SID}_${classId}_${date}`).set({ schoolId: SID, classId, date, statuses });
    }
    const tStatuses = {};
    teacherUserIds.forEach((uid, i) => (tStatuses[uid] = (i + seed) % 7 === 3 ? 'absent' : 'present'));
    await db.collection('teacherAttendance').doc(`${SID}_${date}`).set({ schoolId: SID, date, statuses: tStatuses });
  }
  console.log(`✓ class + teacher attendance for ${days.length} days`);

  // ---- marks: Quarterly for every class ----
  for (const classId of CLASSES) {
    for (const subject of SUBJECTS) {
      const scores = {};
      byClass[classId].forEach((s, i) => (scores[s.id] = 50 + ((i * 7 + subject.length * 5 + classId.charCodeAt(0)) % 48)));
      await db.collection('marks').doc(`${SID}_${classId}_quarterly_${subject}`).set({ schoolId: SID, classId, examId: 'quarterly', subject, maxMarks: 100, scores });
    }
  }
  console.log('✓ quarterly marks (all classes)');

  // ---- fees: 'Annual Fee' ₹5000 per student, mixed installment history ----
  const AMT = 5000, label = 'Annual Fee';
  let fp = 0;
  for (const classId of CLASSES) {
    for (const s of byClass[classId]) {
      const mode = (s.roll + classId.charCodeAt(0)) % 4;
      const payments = mode === 0 ? [{ date: `${ym}-04`, amount: AMT }]
        : mode === 1 ? [{ date: `${ym}-03`, amount: 2000 }, { date: `${ym}-12`, amount: 1500 }]
        : mode === 2 ? [{ date: `${ym}-08`, amount: 2500 }] : [];
      const paid = payments.reduce((a, p) => a + p.amount, 0);
      await db.collection('fees').doc(`${s.id}_fee_${slug(label)}`).set({
        schoolId: SID, studentId: s.id, label, amount: AMT, payments, paidAmount: paid,
        dueDate: `${ym}-20`, status: paid >= AMT ? 'paid' : 'pending',
      });
      fp++;
    }
  }
  console.log(`✓ ${fp} fee records with installments`);

  // ---- notices ----
  const notices = [
    { title: '⚠️ Parent-Teacher Meeting', body: 'PTM for all classes this Saturday, 10 AM – 1 PM. Please attend.', type: 'urgent', audience: 'all', postedBy: 'Head Master', date: `${ym}-14` },
    { title: '🎉 Annual Day Celebrations', body: 'Annual Day on the 26th. Students arrive by 8 AM in white uniform.', type: 'event', audience: 'all', postedBy: 'Head Master', date: `${ym}-11` },
    { title: '📚 Quarterly Exams Schedule', body: 'Quarterly exams begin next month. Timetable on the notice board.', type: 'general', audience: 'all', postedBy: 'Head Master', date: `${ym}-09` },
    { title: '🏏 Inter-School Sports', body: 'Team selections on Friday. Interested students meet the PET.', type: 'event', audience: 'students', postedBy: 'Kishore Kumar', date: `${ym}-07` },
  ];
  for (let i = 0; i < notices.length; i++) await db.collection('notices').doc(`${SID}_n${i + 1}`).set({ schoolId: SID, ...notices[i] });
  console.log('✓ notices');

  // ---- homework ----
  const hw = [
    { classId: '8A', subject: 'Maths', text: 'Exercise 4.2 — all sums. Bring graph book.', date: today },
    { classId: '8A', subject: 'Science', text: 'Draw & label the human digestive system.', date: today },
    { classId: '9A', subject: 'Telugu', text: 'Padyam memorization — page 32.', date: today },
    { classId: '10A', subject: 'English', text: 'Essay: "My Role Model" — 200 words.', date: today },
  ];
  for (let i = 0; i < hw.length; i++) await db.collection('homework').doc(`${SID}_hw${i + 1}`).set({ schoolId: SID, postedBy: 'Class Teacher', ...hw[i] });
  console.log('✓ homework');

  // ---- timetables (simple weekly grid per class) ----
  const PERIODS = ['9:00-9:45', '9:45-10:30', '10:30-11:15', '11:15-11:30', '11:30-12:15', '12:15-1:00'];
  const grid = [
    ['Telugu', 'English', 'Maths', 'BREAK', 'Science', 'Social'],
    ['Maths', 'Telugu', 'English', 'BREAK', 'Hindi', 'Science'],
    ['Science', 'Maths', 'Telugu', 'BREAK', 'English', 'PT'],
    ['Social', 'Science', 'Hindi', 'BREAK', 'Maths', 'Telugu'],
    ['English', 'Social', 'Science', 'BREAK', 'Telugu', 'Drawing'],
    ['PT', 'Drawing', '---', 'BREAK', 'Maths', 'Science'],
  ];
  for (const classId of CLASSES) {
    await db.collection('timetables').doc(`${SID}_${classId}`).set({ schoolId: SID, classId, periods: PERIODS, gridJson: JSON.stringify(grid) });
  }
  console.log('✓ timetables (all classes)\n');

  console.log('===== SAMPLE LOGINS (password: demo123) =====');
  creds.forEach((c) => console.log(c));
  console.log('=============================================\n');
  console.log('Done — every module is now populated.');
}

main().then(() => process.exit(0)).catch((e) => { console.error('Seed failed:', e); process.exit(1); });
