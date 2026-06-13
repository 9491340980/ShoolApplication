/**
 * One-time seeder for a real school: 10 students per class (all 8 classes),
 * 25 teacher login accounts, class-teacher assignments, and a parent per class.
 * All logins use password demo123.
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/seed-school.js
 */
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'vidyasetu-d0ee7',
});
const db = admin.firestore();
const auth = admin.auth();

const PASSWORD = 'demo123';
const CLASSES = ['6A', '7A', '8A', '8B', '9A', '9B', '10A', '10B'];
const SUBJECTS = ['Telugu', 'English', 'Maths', 'Science', 'Social', 'Hindi'];

const FIRST = ['Aarav', 'Sai', 'Priya', 'Kavya', 'Rohan', 'Ananya', 'Vikram', 'Sneha', 'Arjun', 'Divya',
  'Karthik', 'Meera', 'Nikhil', 'Pooja', 'Rahul', 'Sruthi', 'Tarun', 'Lavanya', 'Manish', 'Keerthi',
  'Aditya', 'Bhavana', 'Charan', 'Deepthi', 'Eshwar', 'Harika', 'Naveen', 'Sahithi', 'Yashwanth', 'Ramya'];
const LAST = ['Reddy', 'Rao', 'Sharma', 'Nair', 'Verma', 'Kumar', 'Iyer', 'Patel', 'Naidu', 'Goud',
  'Chowdary', 'Varma'];
const CASTES = ['OC', 'BC-A', 'BC-B', 'BC-D', 'SC', 'ST'];
const TONGUES = ['Telugu', 'Telugu', 'Telugu', 'Hindi', 'Tamil', 'Urdu'];

const TEACHER_NAMES = [
  'Sunitha Devi', 'Ravi Shankar', 'Padmaja Rao', 'Kishore Kumar', 'Anitha Rani',
  'Venkata Subbaiah', 'Lakshmi Narayana', 'Sridevi', 'Mohan Rao', 'Geetha Kumari',
  'Prasad Babu', 'Vani Sree', 'Naresh Chandra', 'Bhargavi', 'Ramesh Yadav',
  'Swapna Reddy', 'Kiran Mai', 'Suresh Varma', 'Jyothi Lakshmi', 'Harinath',
  'Manjula', 'Srinivas Rao', 'Deepika', 'Gopal Krishna', 'Rajitha',
];

async function upsertAuthUser(email, displayName) {
  try {
    const u = await auth.createUser({ email, password: PASSWORD, displayName });
    return u.uid;
  } catch (e) {
    if (e.code === 'auth/email-already-exists') {
      const u = await auth.getUserByEmail(email);
      await auth.updateUser(u.uid, { password: PASSWORD, displayName });
      return u.uid;
    }
    throw e;
  }
}

async function deleteSeeded(sid) {
  const snap = await db.collection('students').where('schoolId', '==', sid).get();
  let n = 0;
  for (const d of snap.docs) {
    if (d.id.includes('_seed') || d.id.includes('_st_')) {
      await d.ref.delete();
      n++;
    }
  }
  if (n) console.log(`(removed ${n} previously-seeded students)`);
}

async function main() {
  const schoolsSnap = await db.collection('schools').get();
  const schools = schoolsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const school =
    schools.find((s) => (s.adminEmail || '').toLowerCase() === 'sandeepetikala1@gmail.com') ||
    schools.find((s) => s.id !== 'demo');
  if (!school) {
    console.log('No target school found. Schools:', schools.map((s) => `${s.name} (${s.id})`));
    return;
  }
  const sid = school.id;
  console.log(`\nSeeding into: ${school.name}  [${sid}]\n`);

  await deleteSeeded(sid);

  // ---- students: 10 per class ----
  const rollOneByClass = {}; // classId -> docId of roll 1 (for parent linking)
  let count = 0;
  for (let c = 0; c < CLASSES.length; c++) {
    const classId = CLASSES[c];
    for (let r = 1; r <= 10; r++) {
      const idx = c * 10 + r;
      const name = `${FIRST[idx % FIRST.length]} ${LAST[(c * 3 + r) % LAST.length]}`;
      const docId = `${sid}_st_${classId}_${String(r).padStart(2, '0')}`;
      if (r === 1) rollOneByClass[classId] = docId;
      await db.collection('students').doc(docId).set({
        schoolId: sid,
        roll: String(r),
        name,
        classId,
        parentPhone: `98765${String(10000 + idx).slice(-5)}`,
        fatherName: `${LAST[(c + r) % LAST.length]} (Father)`,
        motherName: `${FIRST[(idx + 5) % FIRST.length]} (Mother)`,
        caste: CASTES[idx % CASTES.length],
        motherTongue: TONGUES[idx % TONGUES.length],
        admissionNo: `ADM${2000 + idx}`,
      });
      count++;
    }
  }
  console.log(`✓ ${count} students (10 per class × ${CLASSES.length} classes)`);

  // ---- subjects master ----
  await db.collection('subjects').doc(`${sid}_list`).set({ schoolId: sid, names: SUBJECTS });
  console.log('✓ subjects list');

  // ---- 25 teachers (login + record); first 8 become class teachers ----
  const creds = [];
  for (let i = 0; i < TEACHER_NAMES.length; i++) {
    const name = TEACHER_NAMES[i];
    const email = `teacher${String(i + 1).padStart(2, '0')}@viveka.test`;
    const classTeacherOf = i < CLASSES.length ? CLASSES[i] : null;
    const subj = [SUBJECTS[i % SUBJECTS.length], SUBJECTS[(i + 2) % SUBJECTS.length]];
    const uid = await upsertAuthUser(email, name);
    await db.collection('users').doc(uid).set({
      role: 'teacher',
      name,
      email,
      phone: `98760${String(10000 + i).slice(-5)}`,
      schoolId: sid,
      classId: classTeacherOf,
      studentId: null,
    });
    await db.collection('teachers').doc(`${sid}_t${String(i + 1).padStart(2, '0')}`).set({
      schoolId: sid,
      name,
      subjects: subj,
      classes: classTeacherOf ? [classTeacherOf] : [],
      experienceYears: 4 + (i % 15),
      phone: `98760${String(10000 + i).slice(-5)}`,
      active: true,
    });
    if (classTeacherOf) {
      await db.collection('assignments').doc(`${sid}_${classTeacherOf}`).set({
        schoolId: sid,
        classId: classTeacherOf,
        teacherId: uid,
        teacherName: name,
      });
    }
    creds.push(`TEACHER  ${name.padEnd(18)} ${email}  /  ${PASSWORD}${classTeacherOf ? '  (class teacher ' + classTeacherOf + ')' : ''}`);
  }
  console.log(`✓ ${TEACHER_NAMES.length} teachers (8 assigned as class teachers, 17 unassigned)`);

  // ---- one parent per class (linked to roll 1) ----
  for (const classId of CLASSES) {
    const childId = rollOneByClass[classId];
    const email = `parent_${classId.toLowerCase()}@viveka.test`;
    const name = `Parent of ${classId} Roll 1`;
    const uid = await upsertAuthUser(email, name);
    await db.collection('users').doc(uid).set({
      role: 'parent',
      name,
      email,
      phone: `98759${classId.replace(/\D/g, '').padStart(5, '0')}`,
      schoolId: sid,
      studentId: childId,
      classId: null,
    });
    creds.push(`PARENT   ${('Class ' + classId).padEnd(18)} ${email}  /  ${PASSWORD}`);
  }
  console.log(`✓ ${CLASSES.length} parents (one per class)`);

  console.log('\n===== LOGIN CREDENTIALS (password: demo123) =====');
  creds.forEach((c) => console.log(c));
  console.log('=================================================\n');
  console.log('Done.');
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
