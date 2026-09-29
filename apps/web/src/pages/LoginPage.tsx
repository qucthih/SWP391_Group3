import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, ShieldAlert, GraduationCap, School } from 'lucide-react';
import { apiRequest } from '../services/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Xử lý đăng nhập gửi về Backend
  const handleLogin = async (inputEmail: string) => {
    const targetEmail = inputEmail.trim().toLowerCase();

    // 1. Kiểm tra Domain FPT (SRS 6.7.1)
    if (!targetEmail.endsWith('@fpt.edu.vn') && !targetEmail.endsWith('@fe.edu.vn')) {
      setError('Hệ thống chỉ chấp nhận tài khoản email @fpt.edu.vn hoặc @fe.edu.vn');
      return;
    }

    setLoading(true);
    setError('');

    // Gọi API login backend
    // Lưu ý: Trong chế độ dev local, ta gửi credential hoặc email để backend cấp token
    const res = await apiRequest('/auth/google', {
      method: 'POST',
      body: JSON.stringify({
        credential: 'mock_local_dev_token', // Dành cho dev
        email: targetEmail,
      }),
    });

    setLoading(false);

    if (res.success && res.data) {
      // Lưu Token và User Profile
      localStorage.setItem('aita_token', res.data.token);
      localStorage.setItem('aita_user', JSON.stringify(res.data.user));

      // Phân quyền điều hướng theo Role
      if (res.data.user.role === 'LECTURER' || res.data.user.role === 'ADMIN') {
        navigate('/lecturer/dashboard');
      } else {
        navigate('/dashboard');
      }
    } else {
      setError(res.message || 'Đăng nhập không thành công.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-xl p-8 text-center">
        {/* Logo FPT */}
        <div className="w-16 h-16 bg-gradient-to-tr from-orange-500 to-amber-500 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-orange-500/20 mb-4">
          <span className="text-white font-extrabold text-2xl tracking-wider">FPT</span>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">AITA-Intelligent</h1>
        <p className="text-slate-500 text-sm mb-6">
          Nền tảng Trợ lý Giảng dạy & Phân tích Cú pháp AST
        </p>

        {/* Input Email FPT */}
        <div className="mb-4 text-left">
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
            Email FPT Education
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError('');
            }}
            placeholder="tensv@fpt.edu.vn"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-rose-600 bg-rose-50 border border-rose-200 p-3 rounded-xl text-xs mb-4 text-left">
            <ShieldAlert size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Nút bấm Đăng nhập */}
        <div className="space-y-3">
          <button
            onClick={() => handleLogin(email || 'student@fpt.edu.vn')}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-800 font-semibold py-3 px-4 rounded-xl transition duration-200 border border-slate-300 shadow-sm disabled:opacity-50"
          >
            <GraduationCap size={18} className="text-indigo-600" />
            <span>{loading ? 'Đang xác thực...' : 'Đăng nhập với vai trò Sinh viên'}</span>
          </button>

          <button
            onClick={() => handleLogin('lecturer@fe.edu.vn')}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 px-4 rounded-xl text-xs transition duration-200 border border-slate-200 disabled:opacity-50"
          >
            <School size={16} className="text-amber-600" />
            <span>Đăng nhập với vai trò Giảng viên (@fe.edu.vn)</span>
          </button>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-slate-200 text-xs text-slate-400">
          SWP391 - Group 3 • Milestone 3 (Full Pipeline Integration)
        </div>
      </div>
    </div>
  );
}
