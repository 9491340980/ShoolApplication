/**
 * Rich demo-data seeder for the built-in DEMO school (schoolId 'demo'),
 * i.e. what the one-click "Head Master" login on the sign-in screen shows.
 *
 * Populates students, teachers, class-teacher assignments, today's class &
 * teacher attendance, marks, fees WITH installment history, notices and
 * homework — so every screen looks full for demos & the demo video.
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/seed-demo.js
 */
const admin = require('firebase-admin');

admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: 'vidyasetu-d0ee7' });
const db = admin.firestore();

const SID = 'demo';
const CLASSES = ['6A', '7A', '8A', '8B', '9A', '9B', '10A', '10B'];
const SUBJECTS = ['Telugu', 'English', 'Maths', 'Science', 'Social', 'Hindi'];
const today = new Date().toISOString().slice(0, 10);
const ym = today.slice(0, 7); // current yyyy-mm

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

const feeSlug = (label) => label.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24) || 'fee';

async function clearCollection(name) {
  const snap = await db.collection(name).where('schoolId', '==', SID).get();
  let n = 0;
  while (true) {
    const batch = db.batch();
    const slice = snap.docs.slice(n, n + 400);
    if (!slice.length) break;
    slice.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    n += slice.length;
  }
  if (n) console.log(`  cleared ${n} from ${name}`);
}

/** Remove leftover one-click demo-login accounts (teacher/parent/student) so the
 *  user list only shows our seeded teachers. Keeps the demo Head Master. */
async function clearLegacyDemoUsers() {
  const snap = await db.collection('users').where('schoolId', '==', SID).get();
  const batch = db.batch();
  let n = 0;
  snap.docs.forEach((d) => {
    const role = d.data().role;
    if (['teacher', 'parent', 'student'].includes(role) && !d.id.startsWith(`${SID}_tu`)) {
      batch.delete(d.ref);
      n++;
    }
  });
  if (n) await batch.commit();
  if (n) console.log(`  cleared ${n} legacy demo-login users`);
}

async function main() {
  console.log(`\nSeeding DEMO school [${SID}] for ${today}\n`);

  // wipe old demo content so re-runs are clean
  for (const c of ['students', 'teachers', 'assignments', 'attendance', 'teacherAttendance', 'marks', 'fees', 'notices', 'homework', 'expenses']) {
    await clearCollection(c);
  }
  await clearLegacyDemoUsers();

  // school doc
  await db.collection('schools').doc(SID).set(
    { name: 'ZP High School, Vijayawada', adminEmail: 'demo-hm@vidyasetu.app', phone: '9876543210', address: 'Vijayawada, AP', active: true, createdAt: today },
    { merge: true },
  );

  // Permissions: demo showcases every role & module (parent/student are OFF by
  // default for real schools, but ON here so the demo logins all work).
  await db.collection('permissions').doc(`${SID}_perms`).set({ schoolId: SID, roles: {}, disabledModules: ['/certificates'], disabledRoles: [] });

  // subjects master
  await db.collection('subjects').doc(`${SID}_list`).set({ schoolId: SID, names: SUBJECTS });

  // ---- students: 10 per class ----
  const studentsByClass = {};
  let count = 0;
  for (let c = 0; c < CLASSES.length; c++) {
    const classId = CLASSES[c];
    studentsByClass[classId] = [];
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
      studentsByClass[classId].push({ id, roll: r });
      count++;
    }
  }
  console.log(`✓ ${count} students`);

  // ---- teachers + login accounts + class-teacher assignments ----
  const teacherUserIds = []; // users-collection ids (what teacher attendance is keyed by)
  for (let i = 0; i < TEACHER_NAMES.length; i++) {
    const name = TEACHER_NAMES[i];
    const tid = `${SID}_t${String(i + 1).padStart(2, '0')}`;
    const uid = `${SID}_tu${String(i + 1).padStart(2, '0')}`;
    const classTeacherOf = i < CLASSES.length ? CLASSES[i] : null;
    await db.collection('teachers').doc(tid).set({
      schoolId: SID, name,
      subjects: [SUBJECTS[i % SUBJECTS.length], SUBJECTS[(i + 2) % SUBJECTS.length]],
      classes: classTeacherOf ? [classTeacherOf] : [],
      experienceYears: 4 + (i % 15), phone: `98760${String(10000 + i).slice(-5)}`, active: true,
    });
    // user account so the teacher shows up in HM's teacher-attendance list
    await db.collection('users').doc(uid).set({
      role: 'teacher', name, email: `demo-teacher${i + 1}@vidyasetu.app`,
      phone: `98760${String(10000 + i).slice(-5)}`, schoolId: SID, classId: classTeacherOf, studentId: null,
    });
    teacherUserIds.push(uid);
    if (classTeacherOf) {
      await db.collection('assignments').doc(`${SID}_${classTeacherOf}`).set({ schoolId: SID, classId: classTeacherOf, teacherId: uid, teacherName: name });
    }
  }
  console.log(`✓ ${TEACHER_NAMES.length} teachers (+ login accounts, 8 class teachers)`);

  // recent school days (Mon–Sat), newest first
  const days = [];
  for (let d = new Date(today + 'T00:00:00Z'); days.length < 22; d.setUTCDate(d.getUTCDate() - 1)) {
    if (d.getUTCDay() !== 0) days.push(d.toISOString().slice(0, 10)); // skip Sundays
  }

  // ---- class attendance across recent days (mostly present, varied absentees) ----
  for (const date of days) {
    const seed = Number(date.slice(8, 10));
    for (const classId of CLASSES) {
      const statuses = {};
      studentsByClass[classId].forEach((s, i) => (statuses[s.id] = (i + seed) % 8 === 3 ? 'absent' : 'present'));
      await db.collection('attendance').doc(`${SID}_${classId}_${date}`).set({ schoolId: SID, classId, date, statuses });
    }
  }
  // ---- teacher attendance across the same days ----
  for (const date of days) {
    const seed = Number(date.slice(8, 10));
    const statuses = {};
    teacherUserIds.forEach((uid, i) => (statuses[uid] = (i + seed) % 7 === 3 ? 'absent' : 'present'));
    await db.collection('teacherAttendance').doc(`${SID}_${date}`).set({ schoolId: SID, date, statuses });
  }
  console.log(`✓ class + teacher attendance for ${days.length} recent days`);

  // ---- marks: Quarterly for 8A & 9A ----
  for (const classId of ['8A', '9A']) {
    for (const subject of SUBJECTS) {
      const scores = {};
      studentsByClass[classId].forEach((s, i) => (scores[s.id] = 55 + ((i * 7 + subject.length * 5) % 43)));
      await db.collection('marks').doc(`${SID}_${classId}_quarterly_${subject}`).set({ schoolId: SID, classId, examId: 'quarterly', subject, maxMarks: 100, scores });
    }
  }
  console.log('✓ quarterly marks (8A, 9A)');

  // ---- fees: 'Annual Fee' ₹5000 per student, mixed installment history ----
  const AMT = 5000;
  const label = 'Annual Fee';
  let fp = 0;
  for (const classId of CLASSES) {
    for (const s of studentsByClass[classId]) {
      const mode = (s.roll + classId.charCodeAt(0)) % 4; // 0 paid, 1 partial-2, 2 partial-1, 3 pending
      let payments = [];
      if (mode === 0) payments = [{ date: `${ym}-04`, amount: AMT }];
      else if (mode === 1) payments = [{ date: `${ym}-03`, amount: 2000 }, { date: `${ym}-12`, amount: 1500 }];
      else if (mode === 2) payments = [{ date: `${ym}-08`, amount: 2500 }];
      else payments = [];
      const paid = payments.reduce((a, p) => a + p.amount, 0);
      await db.collection('fees').doc(`${s.id}_fee_${feeSlug(label)}`).set({
        schoolId: SID, studentId: s.id, label, amount: AMT, payments, paidAmount: paid,
        dueDate: `${ym}-20`, status: paid >= AMT ? 'paid' : 'pending',
      });
      fp++;
    }
  }
  console.log(`✓ ${fp} fee records with installment history`);

  // ---- notices ----
  const notices = [
    { title: '⚠️ Parent-Teacher Meeting', body: 'PTM for all classes this Saturday, 10 AM – 1 PM. Please attend.', type: 'urgent', audience: 'all', postedBy: 'Head Master', date: `${ym}-14` },
    { title: '🎉 Annual Day Celebrations', body: 'Annual Day on the 26th. Students arrive by 8 AM in white uniform.', type: 'event', audience: 'all', postedBy: 'Head Master', date: `${ym}-11` },
    { title: '📚 Quarterly Exams Schedule', body: 'Quarterly exams begin next month. Timetable on the notice board.', type: 'general', audience: 'all', postedBy: 'Head Master', date: `${ym}-09` },
    { title: '🏏 Inter-School Sports', body: 'Selections for cricket & kabaddi teams on Friday. Interested students meet the PET.', type: 'event', audience: 'students', postedBy: 'Kishore Kumar', date: `${ym}-07` },
  ];
  for (let i = 0; i < notices.length; i++) await db.collection('notices').doc(`${SID}_n${i + 1}`).set({ schoolId: SID, ...notices[i] });
  console.log('✓ notices');

  // ---- homework ----
  const hw = [
    { classId: '8A', subject: 'Maths', text: 'Exercise 4.2 — all sums. Bring graph book.', date: today },
    { classId: '8A', subject: 'Science', text: 'Draw & label the human digestive system.', date: today },
    { classId: '9A', subject: 'Telugu', text: 'Padyam memorization — page 32, learn for recitation.', date: today },
  ];
  for (let i = 0; i < hw.length; i++) await db.collection('homework').doc(`${SID}_hw${i + 1}`).set({ schoolId: SID, postedBy: 'Class Teacher', ...hw[i] });
  console.log('✓ homework');

  // ---- cash book (expenses + income) ----
  const expenses = [
    { type: 'expense', date: `${ym}-03`, category: 'Salaries', description: 'Teacher salaries', amount: 185000, method: 'Bank', payee: 'Staff payroll' },
    { type: 'expense', date: `${ym}-05`, category: 'Utilities', description: 'Electricity & water bill', amount: 8400, method: 'UPI', payee: 'APSPDCL' },
    { type: 'expense', date: `${ym}-08`, category: 'Books & Stationery', description: 'Library books', amount: 9800, method: 'Cash', payee: 'Sri Sai Book House' },
    { type: 'expense', date: `${ym}-12`, category: 'Maintenance', description: 'Plumbing & paint repair', amount: 3500, method: 'Cash', payee: 'Ramesh Works' },
    { type: 'expense', date: `${ym}-15`, category: 'Transport', description: 'Bus diesel', amount: 14500, method: 'Card', payee: 'IOC Petrol Bunk' },
    { type: 'expense', date: `${ym}-18`, category: 'Supplies', description: 'Science lab consumables', amount: 6200, method: 'UPI', payee: 'Lab Mart' },
    { type: 'expense', date: `${ym}-22`, category: 'Rent', description: 'Annexe building rent', amount: 25000, method: 'Bank', payee: 'Landlord' },
    { type: 'income', date: `${ym}-06`, category: 'Donation', description: 'Alumni contribution', amount: 50000, method: 'Bank', payee: 'Alumni Association' },
    { type: 'income', date: `${ym}-14`, category: 'Hall / Bus Rent', description: 'Auditorium rent for event', amount: 12000, method: 'UPI', payee: 'Local committee' },
    { type: 'income', date: `${ym}-20`, category: 'Sale of Forms', description: 'Admission forms', amount: 7500, method: 'Cash', payee: 'New applicants' },
  ];
  for (let i = 0; i < expenses.length; i++) await db.collection('expenses').doc(`${SID}_exp${i + 1}`).set({ schoolId: SID, createdBy: 'Head Master', ...expenses[i] });
  console.log('✓ cash book (expenses + income)\n');

  console.log('Done — demo school is now fully populated.');
}

main().then(() => process.exit(0)).catch((e) => { console.error('Seed failed:', e); process.exit(1); });
