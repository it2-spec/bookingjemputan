// ============================================================
// Login Page
// ============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { CreditCard, ArrowRight } from 'lucide-react';
import tracerLogo from '../assets/tracer.png';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [nik, setNik] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!nik.trim()) {
      setError('Masukkan NIK Anda');
      return;
    }

    setIsLoading(true);
    const result = await login(nik);
    setIsLoading(false);

    if (result.success && result.employee) {
      const role = result.employee.role;
      toast.success(`Login berhasil! Selamat datang, ${result.employee.name}.`);
      if (role === 'superadmin') {
        navigate('/superadmin', { replace: true });
      } else if (role === 'driver') {
        navigate('/driver', { replace: true });
      } else if (role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } else {
      setError(result.error || 'Login gagal');
      toast.error(result.error || 'Login gagal');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/50 to-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary-100/40 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-blue-100/40 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-indigo-100/30 rounded-full blur-2xl" />
      </div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, type: 'spring' }}
        className="w-full max-w-sm relative z-10"
      >
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="inline-flex items-center justify-center w-28 h-28 rounded-3xl bg-white shadow-xl shadow-slate-200/50 p-2 mb-4 border border-slate-100"
          >
            <img src={tracerLogo} alt="TRACER Logo" className="w-full h-full object-contain rounded-2xl" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-3xl font-extrabold text-slate-900 font-[family-name:var(--font-display)] tracking-tight"
          >
            TRACER
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-slate-700 mt-2 text-sm font-semibold"
          >
            Reservasi shuttle karyawan PT. Sakae Riken Indonesia
          </motion.p>
        </div>

        {/* Login card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-300 space-y-2"
        >
          <h2 className="text-xl font-extrabold text-slate-900 font-[family-name:var(--font-display)]">
            Masuk
          </h2>
          <p className="text-sm font-semibold text-slate-700 mb-6">
            Masukkan NIK Anda untuk melanjutkan
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Nomor Induk Karyawan (NIK)"
              placeholder="Masukkan NIK Anda"
              value={nik}
              onChange={(e) => {
                setNik(e.target.value);
                setError('');
              }}
              error={error}
              icon={<CreditCard className="w-5 h-5" />}
              inputMode="numeric"
              autoFocus
              autoComplete="off"
            />

            <Button
              type="submit"
              fullWidth
              size="lg"
              isLoading={isLoading}
              icon={<ArrowRight className="w-5 h-5" />}
            >
              Masuk
            </Button>
          </form>

          <p className="text-center text-xs text-slate-700 font-semibold pt-3">
            Hubungi Admin jika Anda belum terdaftar
          </p>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center text-xs text-slate-700 mt-8 font-bold"
        >
          © 2026 QCC Tracer Team v2.0
        </motion.p>
      </motion.div>
    </div>
  );
}
