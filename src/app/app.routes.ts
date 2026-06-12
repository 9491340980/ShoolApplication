import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'notices',
        loadComponent: () => import('./features/notices/notices.component').then((m) => m.NoticesComponent),
      },
      {
        path: 'students',
        canActivate: [roleGuard],
        data: { roles: ['headmaster', 'teacher'] },
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
        canActivate: [roleGuard],
        data: { roles: ['headmaster', 'parent', 'student'] },
        loadComponent: () => import('./features/fees/fees.component').then((m) => m.FeesComponent),
      },
      {
        path: 'timetable',
        loadComponent: () => import('./features/timetable/timetable.component').then((m) => m.TimetableComponent),
      },
      {
        path: 'teachers',
        canActivate: [roleGuard],
        data: { roles: ['headmaster'] },
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
