import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import StudentDashboardPage from './pages/StudentDashboardPage';
import GradingResultsPage from './pages/GradingResultsPage';
import LecturerDashboardPage from './pages/LecturerDashboardPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<StudentDashboardPage />} />
        <Route path="/submissions/:id/results" element={<GradingResultsPage />} />
        <Route path="/lecturer/dashboard" element={<LecturerDashboardPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
