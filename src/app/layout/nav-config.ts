import { Role } from '../core/models';
import { TKey } from '../core/translations';
import { IconName } from './icon.component';

export interface NavItem {
  path: string;
  icon: IconName;
  label: TKey;
}

export interface NavSection {
  label: TKey;
  items: NavItem[];
}

export const NAV: Record<Role, NavSection[]> = {
  headmaster: [
    {
      label: 'main',
      items: [
        { path: '/dashboard', icon: 'dashboard', label: 'dashboard' },
        { path: '/notices', icon: 'megaphone', label: 'noticeBoard' },
      ],
    },
    {
      label: 'studentsSection',
      items: [
        { path: '/students', icon: 'users', label: 'studentsList' },
        { path: '/attendance', icon: 'check', label: 'attendance' },
        { path: '/marks', icon: 'file', label: 'marksResults' },
        { path: '/fees', icon: 'rupee', label: 'feeManagement' },
      ],
    },
    {
      label: 'school',
      items: [
        { path: '/timetable', icon: 'calendar', label: 'timetable' },
        { path: '/teachers', icon: 'cap', label: 'teachers' },
        { path: '/profile', icon: 'user', label: 'myProfile' },
      ],
    },
  ],
  teacher: [
    {
      label: 'main',
      items: [
        { path: '/dashboard', icon: 'dashboard', label: 'dashboard' },
        { path: '/notices', icon: 'megaphone', label: 'noticeBoard' },
      ],
    },
    {
      label: 'myClass',
      items: [
        { path: '/students', icon: 'users', label: 'myStudents' },
        { path: '/attendance', icon: 'check', label: 'markAttendance' },
        { path: '/marks', icon: 'file', label: 'enterMarks' },
        { path: '/timetable', icon: 'calendar', label: 'myTimetable' },
      ],
    },
    {
      label: 'account',
      items: [{ path: '/profile', icon: 'user', label: 'myProfile' }],
    },
  ],
  parent: [
    {
      label: 'main',
      items: [
        { path: '/dashboard', icon: 'dashboard', label: 'dashboard' },
        { path: '/notices', icon: 'megaphone', label: 'noticeBoard' },
      ],
    },
    {
      label: 'myChild',
      items: [
        { path: '/attendance', icon: 'check', label: 'attendance' },
        { path: '/marks', icon: 'file', label: 'marksResults' },
        { path: '/fees', icon: 'rupee', label: 'feeDetails' },
        { path: '/timetable', icon: 'calendar', label: 'timetable' },
      ],
    },
    {
      label: 'account',
      items: [{ path: '/profile', icon: 'user', label: 'myProfile' }],
    },
  ],
  student: [
    {
      label: 'main',
      items: [
        { path: '/dashboard', icon: 'dashboard', label: 'dashboard' },
        { path: '/notices', icon: 'megaphone', label: 'noticeBoard' },
      ],
    },
    {
      label: 'myAcademics',
      items: [
        { path: '/attendance', icon: 'check', label: 'myAttendance' },
        { path: '/marks', icon: 'file', label: 'myMarks' },
        { path: '/timetable', icon: 'calendar', label: 'timetable' },
      ],
    },
    {
      label: 'account',
      items: [{ path: '/profile', icon: 'user', label: 'myProfile' }],
    },
  ],
};

export const PAGE_TITLES: Record<string, TKey> = {
  '/dashboard': 'dashboard',
  '/notices': 'noticeBoard',
  '/students': 'studentsList',
  '/attendance': 'attendance',
  '/marks': 'marksResults',
  '/fees': 'feeManagement',
  '/timetable': 'timetable',
  '/teachers': 'teachers',
  '/profile': 'myProfile',
};

export const ROLE_LABELS: Record<Role, { icon: string; label: TKey }> = {
  headmaster: { icon: '👨‍💼', label: 'headmaster' },
  teacher: { icon: '👩‍🏫', label: 'teacher' },
  parent: { icon: '👨‍👩‍👧', label: 'parent' },
  student: { icon: '🧒', label: 'student' },
};
