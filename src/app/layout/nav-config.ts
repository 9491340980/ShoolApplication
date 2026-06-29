import { ConfigRole, Role } from '../core/models';
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
  superadmin: [
    {
      label: 'main',
      items: [
        { path: '/admin', icon: 'building', label: 'schools' },
        { path: '/roles', icon: 'shield', label: 'rolesPermissions' },
        { path: '/profile', icon: 'user', label: 'myProfile' },
      ],
    },
  ],
  headmaster: [
    {
      label: 'main',
      items: [
        { path: '/dashboard', icon: 'dashboard', label: 'dashboard' },
        { path: '/notices', icon: 'megaphone', label: 'noticeBoard' },
        { path: '/homework', icon: 'book', label: 'homework' },
      ],
    },
    {
      label: 'studentsSection',
      items: [
        { path: '/students', icon: 'users', label: 'studentsList' },
        { path: '/attendance', icon: 'check', label: 'attendance' },
        { path: '/marks', icon: 'file', label: 'marksResults' },
        { path: '/fees', icon: 'rupee', label: 'feeManagement' },
        { path: '/expenses', icon: 'rupee', label: 'expenses' },
      ],
    },
    {
      label: 'school',
      items: [
        { path: '/reports', icon: 'chart', label: 'reports' },
        { path: '/halltickets', icon: 'file', label: 'hallTickets' },
        { path: '/timetable', icon: 'calendar', label: 'timetable' },
        { path: '/teachers', icon: 'cap', label: 'teachers' },
        { path: '/users', icon: 'users', label: 'userManagement' },
        { path: '/roles', icon: 'shield', label: 'rolesPermissions' },
        { path: '/promote', icon: 'promote', label: 'promotion' },
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
        { path: '/homework', icon: 'book', label: 'homework' },
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
        { path: '/homework', icon: 'book', label: 'homework' },
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
        { path: '/homework', icon: 'book', label: 'homework' },
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

/** Roles whose tabs can be configured, in display order. */
export const CONFIG_ROLES: ConfigRole[] = ['headmaster', 'teacher', 'parent', 'student'];

/**
 * The catalogue of toggleable features for the permission matrix. `roles` lists
 * the roles that may be granted this tab; `core` features are always on (shown
 * locked) so no one can be locked out of the essentials.
 */
export interface Feature {
  path: string;
  icon: IconName;
  label: TKey;
  section: TKey;
  roles: ConfigRole[];
  core?: boolean;
}

export const FEATURES: Feature[] = [
  { path: '/dashboard', icon: 'dashboard', label: 'dashboard', section: 'main', roles: ['headmaster', 'teacher', 'parent', 'student'], core: true },
  { path: '/notices', icon: 'megaphone', label: 'noticeBoard', section: 'main', roles: ['headmaster', 'teacher', 'parent', 'student'] },
  { path: '/homework', icon: 'book', label: 'homework', section: 'main', roles: ['headmaster', 'teacher', 'parent', 'student'] },
  { path: '/students', icon: 'users', label: 'studentsList', section: 'studentsSection', roles: ['headmaster', 'teacher'] },
  { path: '/attendance', icon: 'check', label: 'attendance', section: 'studentsSection', roles: ['headmaster', 'teacher', 'parent', 'student'] },
  { path: '/marks', icon: 'file', label: 'marksResults', section: 'studentsSection', roles: ['headmaster', 'teacher', 'parent', 'student'] },
  { path: '/fees', icon: 'rupee', label: 'feeManagement', section: 'studentsSection', roles: ['headmaster', 'teacher', 'parent', 'student'] },
  { path: '/expenses', icon: 'rupee', label: 'expenses', section: 'studentsSection', roles: ['headmaster'] },
  { path: '/reports', icon: 'chart', label: 'reports', section: 'school', roles: ['headmaster'] },
  { path: '/halltickets', icon: 'file', label: 'hallTickets', section: 'school', roles: ['headmaster'] },
  { path: '/timetable', icon: 'calendar', label: 'timetable', section: 'school', roles: ['headmaster', 'teacher', 'parent', 'student'] },
  { path: '/teachers', icon: 'cap', label: 'teachers', section: 'school', roles: ['headmaster'] },
  { path: '/users', icon: 'users', label: 'userManagement', section: 'school', roles: ['headmaster'] },
  { path: '/promote', icon: 'promote', label: 'promotion', section: 'school', roles: ['headmaster'] },
  { path: '/roles', icon: 'shield', label: 'rolesPermissions', section: 'school', roles: ['headmaster'], core: true },
  { path: '/profile', icon: 'user', label: 'myProfile', section: 'account', roles: ['headmaster', 'teacher', 'parent', 'student'], core: true },
];

/** Built-in default visible tabs per role (mirrors the static NAV above). */
export const DEFAULT_PERMS: Record<ConfigRole, string[]> = {
  headmaster: NAV.headmaster.flatMap((s) => s.items.map((i) => i.path)),
  teacher: NAV.teacher.flatMap((s) => s.items.map((i) => i.path)),
  parent: NAV.parent.flatMap((s) => s.items.map((i) => i.path)),
  student: NAV.student.flatMap((s) => s.items.map((i) => i.path)),
};

/** Paths a role can never lose (resolved on top of any override). */
export function corePaths(role: ConfigRole): string[] {
  return FEATURES.filter((f) => f.core && f.roles.includes(role)).map((f) => f.path);
}

export const PAGE_TITLES: Record<string, TKey> = {
  '/admin': 'schools',
  '/roles': 'rolesPermissions',
  '/users': 'userManagement',
  '/reports': 'reports',
  '/halltickets': 'hallTickets',
  '/promote': 'promotion',
  '/dashboard': 'dashboard',
  '/notices': 'noticeBoard',
  '/homework': 'homework',
  '/students': 'studentsList',
  '/attendance': 'attendance',
  '/marks': 'marksResults',
  '/fees': 'feeManagement',
  '/expenses': 'expenses',
  '/timetable': 'timetable',
  '/teachers': 'teachers',
  '/profile': 'myProfile',
};

export const ROLE_LABELS: Record<Role, { icon: string; label: TKey }> = {
  superadmin: { icon: '🛡️', label: 'superAdmin' },
  headmaster: { icon: '👨‍💼', label: 'headmaster' },
  teacher: { icon: '👩‍🏫', label: 'teacher' },
  parent: { icon: '👨‍👩‍👧', label: 'parent' },
  student: { icon: '🧒', label: 'student' },
};
