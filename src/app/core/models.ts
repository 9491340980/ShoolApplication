export type Role = 'superadmin' | 'headmaster' | 'teacher' | 'parent' | 'student';

export type Lang = 'te' | 'en';

/** The tenant id used by the built-in demo school. */
export const DEMO_SCHOOL_ID = 'demo';

export interface School {
  id: string;
  name: string;
  /** Gmail of the school's owner — signing in with Google with this address grants Head Master access. */
  adminEmail: string;
  phone: string;
  address: string;
  active: boolean;
  createdAt: string; // ISO yyyy-mm-dd
}

export interface AppUser {
  id: string;
  role: Role;
  name: string;
  phone: string;
  email: string;
  /** Tenant the user belongs to. Absent for the super admin. */
  schoolId?: string;
  /** For parents: the student they follow. For students: their own record. */
  studentId?: string;
  /** For teachers: class they are in charge of. */
  classId?: string;
  /** When true, the account cannot sign in (e.g. a teacher who left the school). */
  disabled?: boolean;
}

export interface Student {
  id: string;
  schoolId?: string;
  roll: string;
  name: string;
  classId: string;
  parentPhone: string;
  /** Legacy/demo fallback only — real values are computed from attendance & fee records. */
  attendancePct?: number;
  feeStatus?: 'paid' | 'pending';
  // Full register details (from the school attendance register)
  admissionNo?: string;
  pen?: string; // Permanent Education Number
  apaarId?: string;
  fatherName?: string;
  motherName?: string;
  caste?: string;
  dob?: string; // date of birth (yyyy-mm-dd)
  doa?: string; // date of admission (yyyy-mm-dd)
  motherTongue?: string;
  aadhaar?: string;
  address?: string;
}

export interface Teacher {
  id: string;
  schoolId?: string;
  name: string;
  subjects: string[];
  classes: string[];
  experienceYears: number;
  phone: string;
  active: boolean;
}

export interface Homework {
  id: string;
  schoolId?: string;
  classId: string;
  date: string; // ISO yyyy-mm-dd
  subject: string;
  text: string;
  postedBy: string;
}

export type NoticeType = 'general' | 'urgent' | 'event';

export interface Notice {
  id: string;
  schoolId?: string;
  title: string;
  body: string;
  type: NoticeType;
  audience: 'all' | 'teachers' | 'parents' | 'students';
  postedBy: string;
  date: string; // ISO yyyy-mm-dd
}

export interface FeeItem {
  id: string;
  schoolId?: string;
  studentId: string;
  label: string;
  amount: number;
  dueDate: string;
  status: 'paid' | 'pending';
}

export type AttendanceStatus = 'present' | 'absent';

export interface AttendanceDoc {
  id: string; // `${schoolId}_${classId}_${date}` in Firestore, `${classId}_${date}` locally
  schoolId?: string;
  classId: string;
  date: string;
  statuses: Record<string, AttendanceStatus>; // studentId -> status
}

export interface MarksDoc {
  id: string; // `${schoolId}_${classId}_${examId}_${subject}` in Firestore
  schoolId?: string;
  classId: string;
  examId: string;
  subject: string;
  maxMarks?: number; // defaults to 100 when absent
  scores: Record<string, number>; // studentId -> score
}

export interface TimetableDoc {
  schoolId?: string;
  classId: string;
  /** periods[p] = label like "8:30-9:20"; grid[day][p] = subject or BREAK/--- */
  periods: string[];
  grid: string[][];
}

export const CLASSES = ['6A', '7A', '8A', '8B', '9A', '9B', '10A', '10B'];

/**
 * A subject can carry its own full marks, and optionally be one *part* of a
 * split subject (e.g. group "Science" → parts Theory /70 + Lab /30). `name` is
 * the unique storage key; `group` + `label` drive the grouped entry display.
 */
export interface Subject {
  name: string;
  max: number;
  group?: string;
  label?: string;
}
export const SUBJECTS: Subject[] = [
  { name: 'Telugu', max: 100 },
  { name: 'English', max: 100 },
  { name: 'Maths', max: 100 },
  { name: 'Science', max: 100 },
  { name: 'Social', max: 100 },
  { name: 'Hindi', max: 100 },
];
export interface Exam {
  id: string;
  label: string;
}
export const EXAMS: Exam[] = [
  { id: 'quarterly', label: 'Quarterly Exam' },
  { id: 'halfyearly', label: 'Half Yearly' },
  { id: 'annual', label: 'Annual Exam' },
];
