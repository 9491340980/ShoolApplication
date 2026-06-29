export type Role = 'superadmin' | 'headmaster' | 'teacher' | 'accountant' | 'parent' | 'student';

/** Roles whose visible tabs can be configured (super admin's own tabs are fixed). */
export type ConfigRole = 'headmaster' | 'teacher' | 'accountant' | 'parent' | 'student';

/**
 * Per-school tab/permission overrides. `roles[role]` is the list of allowed
 * feature paths for that role; a role absent here falls back to the built-in
 * defaults. Stored at `permissions/{schoolId}_perms`.
 */
export interface SchoolPermissions {
  id?: string;
  schoolId: string;
  roles: Partial<Record<ConfigRole, string[]>>;
  /** Module paths the super admin turned OFF for the whole school (hidden for everyone). */
  disabledModules?: string[];
  /** Roles the super admin turned OFF for the school (can't sign in / be created). */
  disabledRoles?: Role[];
}

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
  /** Theme preset id (set by super admin); absent → default blue. */
  theme?: string;
  /** School logo as a small square PNG data URL; shown in the app & on every printed/PDF artifact. */
  logo?: string;
}

export interface AppUser {
  id: string;
  /** Primary role — drives the default landing view and page-internal behaviour. */
  role: Role;
  /**
   * Additional roles this user also holds (e.g. a teacher who is also the
   * accountant). Visible tabs & capabilities are the union across all roles.
   */
  extraRoles?: Role[];
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
  /** Token for the passwordless parent-view link (`/p/:token`); set on first share. */
  shareToken?: string;
  /** Soft-delete timestamp (ISO). When set, the record is in the recycle bin. */
  deactivatedAt?: string | null;
}

/** Read-only snapshot of one child, exposed at /p/:token for parents (no login). */
export interface ShareSnapshot {
  token: string;
  schoolId: string;
  schoolName: string;
  logo?: string;
  studentName: string;
  classId: string;
  roll: string;
  attendance: { present: number; absent: number; total: number; pct: number | null; byMonth: { month: string; present: number; absent: number }[] };
  fees: { label: string; amount: number; paid: number; balance: number }[];
  feeTotal: number;
  feePaid: number;
  feeBalance: number;
  exams: { label: string; subjects: { subject: string; score: number; max: number }[]; total: number; max: number; pct: number }[];
  updatedAt: string;
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
  /** Soft-delete timestamp (ISO). When set, the record is in the recycle bin. */
  deactivatedAt?: string | null;
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

export interface FeePayment {
  date: string; // ISO yyyy-mm-dd
  amount: number;
}

export interface FeeItem {
  id: string;
  schoolId?: string;
  studentId: string;
  label: string;
  amount: number; // total fee
  paidAmount?: number; // collected so far (kept in sync with payments); back-compat for old records
  payments?: FeePayment[]; // installment history
  dueDate: string;
  status: 'paid' | 'pending';
}

export interface Expense {
  id: string;
  schoolId?: string;
  /** A cash-book entry — money out (expense) or money in (income). Absent → expense. */
  type?: 'expense' | 'income';
  date: string; // ISO yyyy-mm-dd
  category: string;
  description: string;
  amount: number;
  /** How it was paid/received: Cash / Bank / UPI / Cheque / Card. */
  method?: string;
  /** Vendor (for expense) or source (for income). */
  payee?: string;
  createdBy: string;
}

export const EXPENSE_CATEGORIES = ['Salaries', 'Utilities', 'Maintenance', 'Supplies', 'Transport', 'Events', 'Rent', 'Books & Stationery', 'Marketing', 'Taxes & Fees', 'Miscellaneous'];
export const INCOME_CATEGORIES = ['Donation', 'Grant', 'Event Income', 'Hall / Bus Rent', 'Sale of Forms', 'Interest', 'Other Income'];
export const PAYMENT_METHODS = ['Cash', 'Bank', 'UPI', 'Cheque', 'Card'];

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
  /** Max marks per subject for this exam (e.g. FA = 25, SA = 100). Absent → 100. */
  maxMarks?: number;
}
export const EXAMS: Exam[] = [
  { id: 'quarterly', label: 'Quarterly Exam', maxMarks: 100 },
  { id: 'halfyearly', label: 'Half Yearly', maxMarks: 100 },
  { id: 'annual', label: 'Annual Exam', maxMarks: 100 },
];
