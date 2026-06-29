import { Routes } from '@angular/router';
import { authGuard, permGuard, roleGuard } from './core/guards';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'privacy',
    loadComponent: () => import('./features/privacy/privacy.component').then((m) => m.PrivacyComponent),
  },
  {
    path: 'p/:token',
    loadComponent: () => import('./features/share/parent-share.component').then((m) => m.ParentShareComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [permGuard],
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'admin',
        canActivate: [roleGuard],
        data: { roles: ['superadmin'] },
        loadComponent: () => import('./features/admin/admin.component').then((m) => m.AdminComponent),
      },
      {
        path: 'roles',
        canActivate: [roleGuard],
        data: { roles: ['superadmin', 'headmaster'] },
        loadComponent: () => import('./features/roles/roles.component').then((m) => m.RolesComponent),
      },
      {
        path: 'users',
        loadComponent: () => import('./features/users/users.component').then((m) => m.UsersComponent),
      },
      {
        path: 'reports',
        loadComponent: () => import('./features/reports/reports.component').then((m) => m.ReportsComponent),
      },
      {
        path: 'expenses',
        loadComponent: () => import('./features/expenses/expenses.component').then((m) => m.ExpensesComponent),
      },
      {
        path: 'promote',
        loadComponent: () => import('./features/promote/promote.component').then((m) => m.PromoteComponent),
      },
      {
        path: 'halltickets',
        loadComponent: () => import('./features/halltickets/halltickets.component').then((m) => m.HallTicketsComponent),
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'notices',
        loadComponent: () => import('./features/notices/notices.component').then((m) => m.NoticesComponent),
      },
      {
        path: 'homework',
        loadComponent: () => import('./features/homework/homework.component').then((m) => m.HomeworkComponent),
      },
      {
        path: 'students',
        loadComponent: () => import('./features/students/students.component').then((m) => m.StudentsComponent),
      },
      {
        path: 'attendance',
        loadComponent: () => import('./features/attendance/attendance.component').then((m) => m.AttendanceComponent),
      },
      {
        path: 'marks',
        loadComponent: () => import('./features/marks/marks.component').then((m) => m.MarksComponent),
      },
      {
        path: 'fees',
        loadComponent: () => import('./features/fees/fees.component').then((m) => m.FeesComponent),
      },
      {
        path: 'timetable',
        loadComponent: () => import('./features/timetable/timetable.component').then((m) => m.TimetableComponent),
      },
      {
        path: 'teachers',
        loadComponent: () => import('./features/teachers/teachers.component').then((m) => m.TeachersComponent),
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile.component').then((m) => m.ProfileComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
