export type Role = 'headmaster' | 'teacher' | 'parent' | 'student';

export type Lang = 'te' | 'en';

export interface AppUser {
  id: string;
  role: Role;
  name: string;
  phone: string;
  email: string;
  /** For parents: the student they follow. For students: their own record. */
  studentId?: string;
  /** For teachers: class they are in charge of. */
  classId?: string;
}

export interface Student {
  id: string;
  roll: string;
  name: string;
  classId: string;
  parentPhone: string;
  attendancePct: number;
  feeStatus: 'paid' | 'pending';
}

export interface Teacher {
  id: string;
  name: string;
  subjects: string[];
  classes: string[];
  experienceYears: number;
  phone: string;
  active: boolean;
}

export type NoticeType = 'general' | 'urgent' | 'event';

export interface Notice {
  id: string;
  title: string;
  body: string;
  type: NoticeType;
  audience: 'all' | 'teachers' | 'parents' | 'students';
  postedBy: string;
  date: string; // ISO yyyy-mm-dd
}

export interface FeeItem {
  id: string;
  studentId: string;
  label: string;
  amount: number;
  dueDate: string;
  status: 'paid' | 'pending';
}

export type AttendanceStatus = 'present' | 'absent';

export interface AttendanceDoc {
  id: string; // `${classId}_${date}`
  classId: string;
  date: string;
  statuses: Record<string, AttendanceStatus>; // studentId -> status
}

export interface MarksDoc {
  id: string; // `${classId}_${examId}_${subject}`
  classId: string;
  examId: string;
  subject: string;
  scores: Record<string, number>; // studentId -> score (out of 100)
}

export interface TimetableDoc {
  classId: string;
  /** periods[p] = label like "8:30-9:20"; grid[day][p] = subject or BREAK/--- */
  periods: string[];
  grid: string[][];
}

export const CLASSES = ['6A', '7A', '8A', '8B', '9A', '9B', '10A', '10B'];
export const SUBJECTS = ['Telugu', 'English', 'Maths', 'Science', 'Social', 'Hindi'];
export const EXAMS = [
  { id: 'quarterly', label: 'Quarterly Exam' },
  { id: 'halfyearly', label: 'Half Yearly' },
  { id: 'annual', label: 'Annual Exam' },
];
