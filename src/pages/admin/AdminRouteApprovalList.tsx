import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { CheckCircle2, XCircle, Clock, User, ArrowRight, ShieldAlert, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminRouteApprovalList() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      // 1. Try relational query using column hints
      let { data, error } = await supabase
        .from('route_change_requests')
        .select(`
          *,
          employee:employees(*),
          current_route:routes!current_route_id(route_name),
          requested_route:routes!requested_route_id(route_name)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback manual join if PostgREST schema relation cache is not initialized yet
        const { data: rawReqs } = await supabase
          .from('route_change_requests')
          .select('*')
          .order('created_at', { ascending: false });

        const { data: emps } = await supabase.from('employees').select('*');
        const { data: rts } = await supabase.from('routes').select('*');

        if (rawReqs) {
          data = rawReqs.map((r: any) => ({
            ...r,
            employee: emps?.find((e) => e.id === r.employee_id),
            current_route: rts?.find((rt) => rt.id === r.current_route_id),
            requested_route: rts?.find((rt) => rt.id === r.requested_route_id),
          }));
        }
      }

      setRequests(data || []);
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal memuat daftar pengajuan rute');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (req: any) => {
    try {
      // 1. Update request status to approved
      const { error: reqErr } = await supabase
        .from('route_change_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', req.id);

      if (reqErr) throw reqErr;

      // 2. Update employee assigned_route_id
      const { error: empErr } = await supabase
        .from('employees')
        .update({
          assigned_route_id: req.requested_route_id,
        })
        .eq('id', req.employee_id);

      if (empErr) throw empErr;

      toast.success(`Pengajuan rute ${req.employee?.name} disetujui!`);
      fetchRequests();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyetujui pengajuan');
    }
  };

  const handleReject = async (reqId: string) => {
    try {
      const { error } = await supabase
        .from('route_change_requests')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', reqId);

      if (error) throw error;
      toast.success('Pengajuan rute ditolak');
      fetchRequests();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menolak pengajuan');
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" /> Approval Perubahan Rute Penumpang
          </h2>
          <p className="text-xs text-slate-500">
            Persetujuan permohonan alokasi rute jemputan karyawan
          </p>
        </div>
        <button
          onClick={fetchRequests}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-1.5 text-xs font-semibold"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {pendingCount > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            <div>
              <div className="text-xs font-bold text-amber-900">
                Terdapat {pendingCount} Pengajuan Menunggu Verification Admin
              </div>
              <div className="text-[11px] text-amber-700">
                Segera setujui agar penumpang dapat memesan tiket di rute barunya.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Requests List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-100">
          {requests.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              Belum ada permohonan alokasi rute jemputan.
            </div>
          ) : (
            requests.map((req) => (
              <div key={req.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center font-bold shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">
                        {req.employee?.name || 'Karyawan'}
                      </h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        NIK: {req.employee?.nik}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">
                      {req.employee?.department} • Diajukan pada {new Date(req.created_at).toLocaleDateString('id-ID')}
                    </p>

                    {/* Route Transition Badge */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg font-medium">
                        {req.current_route?.route_name || 'Karawang Barat (Default)'}
                      </span>
                      <ArrowRight className="w-4 h-4 text-primary-500" />
                      <span className="px-2 py-1 bg-primary-100 text-primary-700 border border-primary-300 rounded-lg font-bold">
                        {req.requested_route?.route_name || 'Rute Tujuan'}
                      </span>
                    </div>

                    {req.reason && (
                      <p className="text-xs text-slate-500 italic mt-2">
                        &quot;{req.reason}&quot;
                      </p>
                    )}
                  </div>
                </div>

                {/* Status & Actions */}
                <div className="flex items-center gap-3 self-end md:self-center">
                  {req.status === 'pending' ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReject(req.id)}
                        className="px-3 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" /> Tolak
                      </button>
                      <button
                        onClick={() => handleApprove(req)}
                        className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Setujui Rute
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${
                        req.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {req.status}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
