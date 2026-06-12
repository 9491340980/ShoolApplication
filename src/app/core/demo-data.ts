import { AppUser, AttendanceDoc, FeeItem, MarksDoc, Notice, Role, Student, Teacher, TimetableDoc } from './models';

export const DEMO_USERS: Record<Role, AppUser> = {
  headmaster: { id: 'u-hm', role: 'headmaster', name: 'Ramesh Kumar', phone: '9876543210', email: 'demo-hm@vidyasetu.app' },
  teacher: { id: 'u-t1', role: 'teacher', name: 'Sunitha Devi', phone: '9876500001', email: 'demo-teacher@vidyasetu.app', classId: '8A' },
  parent: { id: 'u-p1', role: 'parent', name: 'Lakshmi Reddy', phone: '9876543211', email: 'demo-parent@vidyasetu.app', studentId: 's14' },
  student: { id: 'u-s1', role: 'student', name: 'Ravi Kumar', phone: '9876543211', email: 'demo-student@vidyasetu.app', studentId: 's14', classId: '8A' },
};

/** Demo password for the email/password form (all four demo accounts). */
export const DEMO_PASSWORD = 'demo1234';

export const DEMO_STUDENTS: Student[] = [
  { id: 's01', roll: '01', name: 'Arjun Reddy', classId: '8A', parentPhone: '9876543210', attendancePct: 92, feeStatus: 'paid' },
  { id: 's02', roll: '02', name: 'Sravani Devi', classId: '8A', parentPhone: '9876543211', attendancePct: 88, feeStatus: 'pending' },
  { id: 's03', roll: '03', name: 'Kiran Kumar', classId: '8A', parentPhone: '9876543212', attendancePct: 95, feeStatus: 'paid' },
  { id: 's04', roll: '04', name: 'Anusha Kumari', classId: '8A', parentPhone: '9876543217', attendancePct: 97, feeStatus: 'paid' },
  { id: 's05', roll: '05', name: 'Suresh Babu', classId: '8A', parentPhone: '9876543218', attendancePct: 84, feeStatus: 'paid' },
  { id: 's06', roll: '06', name: 'Meena Kumari', classId: '8A', parentPhone: '9876543219', attendancePct: 91, feeStatus: 'paid' },
  { id: 's07', roll: '07', name: 'Vamsi Krishna', classId: '8A', parentPhone: '9876543220', attendancePct: 79, feeStatus: 'pending' },
  { id: 's08', roll: '08', name: 'Divya Sri', classId: '8A', parentPhone: '9876543215', attendancePct: 85, feeStatus: 'paid' },
  { id: 's09', roll: '09', name: 'Harsha Vardhan', classId: '8A', parentPhone: '9876543221', attendancePct: 93, feeStatus: 'paid' },
  { id: 's10', roll: '10', name: 'Bhavani Prasad', classId: '8A', parentPhone: '9876543222', attendancePct: 87, feeStatus: 'paid' },
  { id: 's11', roll: '11', name: 'Sandhya Rani', classId: '8A', parentPhone: '9876543223', attendancePct: 90, feeStatus: 'paid' },
  { id: 's12', roll: '12', name: 'Naveen Chandra', classId: '8A', parentPhone: '9876543224', attendancePct: 82, feeStatus: 'pending' },
  { id: 's14', roll: '14', name: 'Ravi Kumar', classId: '8A', parentPhone: '9876543211', attendancePct: 87, feeStatus: 'pending' },
  { id: 's21', roll: '01', name: 'Pooja Rani', classId: '9A', parentPhone: '9876543213', attendancePct: 78, feeStatus: 'pending' },
  { id: 's22', roll: '02', name: 'Venkat Rao', classId: '9A', parentPhone: '9876543214', attendancePct: 90, feeStatus: 'paid' },
  { id: 's23', roll: '03', name: 'Swathi Priya', classId: '9A', parentPhone: '9876543225', attendancePct: 94, feeStatus: 'paid' },
  { id: 's31', roll: '01', name: 'Ramu Naidu', classId: '10B', parentPhone: '9876543216', attendancePct: 72, feeStatus: 'pending' },
  { id: 's32', roll: '02', name: 'Lavanya Devi', classId: '10B', parentPhone: '9876543226', attendancePct: 89, feeStatus: 'paid' },
];

export const DEMO_TEACHERS: Teacher[] = [
  { id: 't1', name: 'Sunitha Devi', subjects: ['Telugu', 'Social'], classes: ['8A', '9A'], experienceYears: 12, phone: '9876500001', active: true },
  { id: 't2', name: 'Ravi Shankar', subjects: ['Maths', 'Science'], classes: ['8B', '9B'], experienceYears: 8, phone: '9876500002', active: true },
  { id: 't3', name: 'Padmaja', subjects: ['English', 'Hindi'], classes: ['8A', '10A'], experienceYears: 15, phone: '9876500003', active: true },
  { id: 't4', name: 'Kishore Kumar', subjects: ['Science', 'PT'], classes: ['9A', '10B'], experienceYears: 6, phone: '9876500004', active: true },
  { id: 't5', name: 'Anitha Rani', subjects: ['Drawing', 'Social'], classes: ['8B', '10A'], experienceYears: 10, phone: '9876500005', active: true },
];

export const DEMO_NOTICES: Notice[] = [
  { id: 'n1', title: '⚠️ PTM - June 20th', body: 'Parent Teacher Meeting for all classes. Afternoon 2:00 PM - 4:00 PM. All parents must attend.', type: 'urgent', audience: 'all', postedBy: 'Head Master', date: '2026-06-10' },
  { id: 'n2', title: '🎉 School Day Function', body: 'June 26 - Annual School Day on school grounds. Students must wear white uniform. Arrive by 8:00 AM.', type: 'event', audience: 'all', postedBy: 'Head Master', date: '2026-06-08' },
  { id: 'n3', title: '📚 Quarterly Exam Schedule', body: 'Quarterly exams begin July 5. Timetable is on the school notice board. Prepare well.', type: 'general', audience: 'all', postedBy: 'Head Master', date: '2026-06-05' },
  { id: 'n4', title: '🎨 Drawing Competition', body: 'June 25 - Drawing competition for classes 6-10. Interested students register with the Drawing teacher.', type: 'event', audience: 'students', postedBy: 'Anitha Rani', date: '2026-06-03' },
];

export const DEMO_FEES: FeeItem[] = [
  { id: 'f1', studentId: 's14', label: 'Tuition Fee', amount: 2000, dueDate: '2026-06-20', status: 'paid' },
  { id: 'f2', studentId: 's14', label: 'Exam Fee', amount: 500, dueDate: '2026-07-01', status: 'paid' },
  { id: 'f3', studentId: 's14', label: 'Sports Fee', amount: 200, dueDate: '2026-06-20', status: 'pending' },
  { id: 'f4', studentId: 's14', label: 'Library Fee', amount: 100, dueDate: '2026-07-01', status: 'pending' },
  { id: 'f5', studentId: 's02', label: 'Tuition Fee', amount: 500, dueDate: '2026-06-20', status: 'pending' },
  { id: 'f6', studentId: 's21', label: 'Tuition Fee', amount: 700, dueDate: '2026-06-20', status: 'pending' },
  { id: 'f7', studentId: 's31', label: 'Tuition Fee', amount: 500, dueDate: '2026-06-20', status: 'pending' },
  { id: 'f8', studentId: 's07', label: 'Exam Fee', amount: 300, dueDate: '2026-06-25', status: 'pending' },
  { id: 'f9', studentId: 's12', label: 'Sports Fee', amount: 200, dueDate: '2026-06-25', status: 'pending' },
];

const SCORE_TABLE: Record<string, Record<string, number>> = {
  // subject -> studentId -> score (Quarterly, 8A)
  Telugu: { s01: 82, s02: 74, s03: 91, s04: 88, s05: 67, s06: 79, s07: 58, s08: 85, s09: 90, s10: 72, s11: 81, s12: 64, s14: 82 },
  English: { s01: 75, s02: 68, s03: 88, s04: 92, s05: 61, s06: 73, s07: 52, s08: 80, s09: 86, s10: 69, s11: 77, s12: 59, s14: 68 },
  Maths: { s01: 91, s02: 70, s03: 95, s04: 89, s05: 72, s06: 81, s07: 60, s08: 87, s09: 93, s10: 75, s11: 84, s12: 66, s14: 91 },
  Science: { s01: 78, s02: 72, s03: 90, s04: 85, s05: 65, s06: 76, s07: 55, s08: 82, s09: 88, s10: 71, s11: 79, s12: 62, s14: 74 },
  Social: { s01: 80, s02: 76, s03: 87, s04: 90, s05: 68, s06: 78, s07: 57, s08: 84, s09: 89, s10: 73, s11: 80, s12: 63, s14: 78 },
  Hindi: { s01: 70, s02: 65, s03: 84, s04: 86, s05: 60, s06: 71, s07: 50, s08: 78, s09: 83, s10: 67, s11: 74, s12: 58, s14: 65 },
};

export const DEMO_MARKS: MarksDoc[] = Object.entries(SCORE_TABLE).map(([subject, scores]) => ({
  id: `8A_quarterly_${subject}`,
  classId: '8A',
  examId: 'quarterly',
  subject,
  scores,
}));

const PERIODS = ['8:30-9:20', '9:20-10:10', '10:10-11:00', '11:00-11:20', '11:20-12:10', '12:10-1:00'];
// grid[day][period]; day order: Mon..Sat
const GRID_8A = [
  ['Telugu', 'English', 'Maths', 'BREAK', 'Science', 'Social'],
  ['Maths', 'Telugu', 'English', 'BREAK', 'Hindi', 'Science'],
  ['Science', 'Maths', 'Telugu', 'BREAK', 'English', 'PT'],
  ['Social', 'Science', 'Hindi', 'BREAK', 'Maths', 'Telugu'],
  ['English', 'Social', 'Science', 'BREAK', 'Telugu', 'Drawing'],
  ['PT', 'Drawing', '---', 'BREAK', 'Maths', 'Science'],
];

export const DEMO_TIMETABLES: TimetableDoc[] = ['6A', '7A', '8A', '8B', '9A', '9B', '10A', '10B'].map((classId) => ({
  classId,
  periods: PERIODS,
  grid: GRID_8A,
}));

/** Month label + attendance % pairs for the parent/student view. */
export const DEMO_MONTHLY_ATTENDANCE: { month: string; pct: number }[] = [
  { month: 'Jun', pct: 95 },
  { month: 'Jul', pct: 88 },
  { month: 'Aug', pct: 92 },
  { month: 'Sep', pct: 85 },
  { month: 'Oct', pct: 90 },
  { month: 'Nov', pct: 87 },
  { month: 'Dec', pct: 93 },
  { month: 'Jan', pct: 91 },
  { month: 'Feb', pct: 84 },
  { month: 'Mar', pct: 88 },
];

export const DEMO_CLASS_ATTENDANCE_TODAY: { classId: string; pct: number }[] = [
  { classId: '6th', pct: 88 },
  { classId: '7th', pct: 94 },
  { classId: '8th', pct: 91 },
  { classId: '9th', pct: 96 },
  { classId: '10th', pct: 89 },
];

export const DEMO_ATTENDANCE: AttendanceDoc[] = [];
