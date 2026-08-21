import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Employee, UserRole, Route } from '../../lib/types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import {
  Users,
  Search,
  UserPlus,
  Edit3,
  Trash2,
  Bus,
  CreditCard,
  Building,
  Phone,
  RefreshCw,
  FileSpreadsheet,
  Upload,
  Download,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

export default function SuperAdminPassengers() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Form Fields
  const [nik, setNik] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('Executive');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('employee');
  const [driverType, setDriverType] = useState<'internal' | 'vendor'>('vendor');
  const [assignedRouteId, setAssignedRouteId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Delete Confirmation State
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);

  // Import Massal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        NIK: '1005',
        Nama: 'Budi Santoso',
        Departemen: 'Production',
        No_HP: '08123456789',
        Role: 'employee',
        Tipe_Driver: '',
        Nama_Rute: 'Karawang Barat',
      },
      {
        NIK: '1006',
        Nama: 'Siti Rahma',
        Departemen: 'Quality Control',
        No_HP: '08567890123',
        Role: 'employee',
        Tipe_Driver: '',
        Nama_Rute: 'Karawang Timur',
      },
      {
        NIK: '2001',
        Nama: 'Pak Mamat',
        Departemen: 'Internal PT',
        No_HP: '08199988877',
        Role: 'driver',
        Tipe_Driver: 'internal',
        Nama_Rute: 'Karawang Barat',
      },
      {
        NIK: '2002',
        Nama: 'Pak Caing',
        Departemen: 'Vendor Transport',
        No_HP: '08199988888',
        Role: 'driver',
        Tipe_Driver: 'vendor',
        Nama_Rute: 'Karawang Barat',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template User');
    XLSX.writeFile(wb, 'Template_Import_User_Shuttle.xlsx');
    toast.success('Template Excel berhasil didownload! 📄');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data: any[] = XLSX.utils.sheet_to_json(ws);

        if (!data || data.length === 0) {
          toast.error('File Excel kosong atau format tidak sesuai!');
          setImporting(false);
          return;
        }

        const validEmployees: any[] = [];

        for (const row of data) {
          const rowNik = String(row.NIK || row.nik || '').trim();
          const rowName = String(row.Nama || row.nama || row.Name || row.name || '').trim();
          const rowDept = String(row.Departemen || row.departemen || row.Department || 'General').trim();
          const rowPhone = String(row.No_HP || row.no_hp || row.Phone || row.phone || '').trim();
          const rawRole = String(row.Role || row.role || 'employee').toLowerCase().trim();
          const rawDriverType = String(row.Tipe_Driver || row.tipe_driver || row.driver_type || '').toLowerCase().trim();
          const rowRouteName = String(row.Nama_Rute || row.nama_rute || row.Route || '').trim();

          if (!rowNik || !rowName) continue;

          let finalRole: UserRole = 'employee';
          if (['superadmin', 'admin', 'driver', 'employee'].includes(rawRole)) {
            finalRole = rawRole as UserRole;
          }

          let matchedRouteId = null;
          if (rowRouteName) {
            const found = routes.find(r => r.route_name.toLowerCase().includes(rowRouteName.toLowerCase()));
            if (found) matchedRouteId = found.id;
          }

          const empPayload: any = {
            nik: rowNik,
            name: rowName,
            department: rowDept,
            phone: rowPhone || null,
            role: finalRole,
            assigned_route_id: matchedRouteId,
          };

          if (finalRole === 'driver') {
            empPayload.driver_type = rawDriverType === 'internal' ? 'internal' : 'vendor';
          }

          validEmployees.push(empPayload);
        }

        if (validEmployees.length === 0) {
          toast.error('Tidak ada baris data valid yang bisa diimport.');
          setImporting(false);
          return;
        }

        const { error } = await supabase
          .from('employees')
          .upsert(validEmployees, { onConflict: 'nik' });

        if (error) throw error;

        toast.success(`Berhasil mengimport/update ${validEmployees.length} user! 🎉`);
        setShowImportModal(false);
        fetchEmployeesAndRoutes();
      } catch (err: any) {
        toast.error(err.message || 'Gagal memproses file Excel.');
      } finally {
        setImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const fetchEmployeesAndRoutes = async () => {
    setLoading(true);
    try {
      const [empRes, routeRes] = await Promise.all([
        supabase.from('employees').select('*').order('name', { ascending: true }),
        supabase.from('routes').select('*').order('route_name', { ascending: true }),
      ]);

      if (empRes.data) setEmployees(empRes.data as Employee[]);
      if (routeRes.data) setRoutes(routeRes.data as Route[]);
    } catch (err: any) {
      toast.error('Gagal memuat data karyawan/rute');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployeesAndRoutes();
  }, []);

  const openCreateModal = () => {
    setEditingEmployee(null);
    setNik('');
    setName('');
    setDepartment('Executive');
    setPhone('');
    setRole('employee');
    setDriverType('vendor');
    setAssignedRouteId('');
    setShowModal(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setNik(emp.nik);
    setName(emp.name);
    setDepartment(emp.department || 'Executive');
    setPhone(emp.phone || '');
    setRole(emp.role);
    setDriverType(emp.driver_type || 'vendor');
    setAssignedRouteId(emp.assigned_route_id || '');
    setShowModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nik.trim() || !name.trim()) {
      toast.error('NIK dan Nama wajib diisi!');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        nik: nik.trim(),
        name: name.trim(),
        department: department.trim() || 'General',
        phone: phone.trim() || null,
        role,
        assigned_route_id: assignedRouteId || null,
      };

      if (role === 'driver') {
        payload.driver_type = driverType;
      } else {
        payload.driver_type = null;
      }

      if (editingEmployee) {
        // Update
        const { error } = await supabase
          .from('employees')
          .update(payload)
          .eq('id', editingEmployee.id);
        if (error) throw error;
        toast.success(`User ${name} berhasil diperbarui!`);
      } else {
        // Create
        const { error } = await supabase.from('employees').insert(payload);
        if (error) throw error;
        toast.success(`User ${name} berhasil ditambahkan!`);
      }

      setShowModal(false);
      fetchEmployeesAndRoutes();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan data user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingEmployee) return;
    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', deletingEmployee.id);

      if (error) throw error;

      toast.success(`User ${deletingEmployee.name} berhasil dihapus.`);
      setDeletingEmployee(null);
      fetchEmployeesAndRoutes();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus user');
    }
  };

  // Filtering
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.nik.includes(searchTerm) ||
      emp.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || emp.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-[family-name:var(--font-display)] flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" /> Kelola Karyawan & Pengguna Sistem
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Superadmin memiliki akses penuh untuk menambah, mengedit profil, serta menentukan hak akses (Role) seluruh pengguna.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handleDownloadTemplate}
            variant="outline"
            size="sm"
            icon={<Download className="w-4 h-4 text-emerald-600" />}
          >
            Template Excel
          </Button>
          <Button
            onClick={() => setShowImportModal(true)}
            variant="secondary"
            size="sm"
            icon={<FileSpreadsheet className="w-4 h-4 text-blue-600" />}
          >
            Import Massal (.xlsx)
          </Button>
          <Button
            onClick={openCreateModal}
            variant="primary"
            size="sm"
            icon={<UserPlus className="w-4 h-4" />}
          >
            + Tambah Single User
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <Card className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Cari NIK, Nama Karyawan, atau Departemen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 font-medium cursor-pointer"
            >
              <option value="all">Semua Role Akses</option>
              <option value="employee">Employee (Karyawan)</option>
              <option value="driver">Driver (Pengemudi)</option>
              <option value="admin">Admin Operasional</option>
              <option value="superadmin">Superadmin</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Employees Grid / Table */}
      {loading ? (
        <div className="py-12 text-center text-slate-500 text-sm">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
          Memuat data karyawan...
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
          <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-700">Tidak ada user ditemukan</p>
          <p className="text-xs text-slate-500 mt-1">Coba sesuaikan kata kunci pencarian Anda</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map((emp) => {
            const routeName = (emp as any).assigned_route?.route_name;

            return (
              <Card key={emp.id} className="relative flex flex-col justify-between hover:border-slate-300 transition-all">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-sm border border-slate-200">
                        {emp.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">{emp.name}</h3>
                        <p className="text-xs text-slate-500 font-mono">NIK: {emp.nik}</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                          emp.role === 'superadmin'
                            ? 'bg-purple-100 text-purple-700 border border-purple-200'
                            : emp.role === 'admin'
                            ? 'bg-amber-100 text-amber-700 border border-amber-200'
                            : emp.role === 'driver'
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {emp.role}
                      </span>
                      {emp.role === 'driver' && (
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            emp.driver_type === 'internal'
                              ? 'bg-slate-100 text-slate-800 border border-slate-300'
                              : 'bg-blue-50 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {emp.driver_type === 'internal' ? '🏢 Internal PT' : '💳 Sewa Vendor'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{emp.department}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{emp.phone || 'Belum diisi'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Bus className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span>Rute: <strong className="text-slate-900">{routeName || 'Karawang Barat (Default)'}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <Button
                    onClick={() => openEditModal(emp)}
                    variant="ghost"
                    size="sm"
                    icon={<Edit3 className="w-3.5 h-3.5 text-blue-600" />}
                  >
                    Edit
                  </Button>
                  <Button
                    onClick={() => setDeletingEmployee(emp)}
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:bg-red-50"
                    icon={<Trash2 className="w-3.5 h-3.5 text-red-600" />}
                  >
                    Hapus
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Form Tambah / Edit User */}
      <Dialog
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingEmployee ? `Edit User: ${editingEmployee.name}` : 'Tambah User Baru'}
      >
        <form onSubmit={handleSaveUser} className="space-y-4 pt-1">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Nomor Induk Karyawan (NIK) <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="Contoh: 1001"
              value={nik}
              onChange={(e) => setNik(e.target.value)}
              icon={<CreditCard className="w-4 h-4" />}
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Nama Lengkap Karyawan <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="Contoh: Ahmad Subagja"
              value={name}
              onChange={(e) => setName(e.target.value)}
              icon={<Users className="w-4 h-4" />}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Departemen
              </label>
              <input
                type="text"
                placeholder="Contoh: Production"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                No. Telepon / WA
              </label>
              <input
                type="text"
                placeholder="08123456789"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Role Akses Sistem <span className="text-red-500">*</span>
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold text-slate-900 cursor-pointer"
            >
              <option value="employee">Employee (Karyawan Biasa)</option>
              <option value="driver">Driver (Pengemudi Jemputan)</option>
              <option value="admin">Admin (Operasional Booking)</option>
              <option value="superadmin">Superadmin (Akses Penuh)</option>
            </select>
          </div>

          {role === 'driver' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1.5">
              <label className="text-xs font-bold text-blue-900 block">
                🏢 Kategori / Tipe Driver <span className="text-red-500">*</span>
              </label>
              <select
                value={driverType}
                onChange={(e) => setDriverType(e.target.value as 'internal' | 'vendor')}
                className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold text-blue-950 cursor-pointer"
              >
                <option value="vendor">💳 Driver Sewa Vendor (Masuk Tagihan Invoice)</option>
                <option value="internal">🏢 Driver Internal PT (Armada / Supir Sendiri - Rp 0)</option>
              </select>
              <p className="text-[11px] text-blue-700">
                Menentukan apakah unit yang dikemudikan driver ini otomatis ditagih di invoice atau Rp 0.
              </p>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Rute Default Terdaftar
            </label>
            <select
              value={assignedRouteId}
              onChange={(e) => setAssignedRouteId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 cursor-pointer"
            >
              <option value="">-- Karawang Barat (Default) --</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.route_name} ({r.departure_time} WIB)
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-3">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => setShowModal(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              fullWidth
              isLoading={submitting}
            >
              {editingEmployee ? 'Simpan Perubahan' : 'Buat User'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        isOpen={!!deletingEmployee}
        onClose={() => setDeletingEmployee(null)}
        title="Hapus User"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Apakah Anda yakin ingin menghapus user <strong className="text-slate-900">{deletingEmployee?.name}</strong> (NIK: {deletingEmployee?.nik})?
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setDeletingEmployee(null)}>
              Batal
            </Button>
            <Button variant="danger" fullWidth onClick={handleDeleteUser}>
              Ya, Hapus
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Modal Import Massal Excel */}
      <Dialog
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Import Data User Massal (.xlsx)"
      >
        <div className="space-y-4 pt-1">
          <p className="text-xs text-slate-600">
            Unggah file Excel yang berisi daftar karyawan/user baru. Gunakan format template agar data terbaca sempurna oleh sistem.
          </p>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs text-slate-700">
            <p className="font-bold flex items-center gap-1.5 text-slate-900">
              <Download className="w-4 h-4 text-emerald-600" /> Format Kolom Excel:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-600 font-mono text-[11px]">
              <li><strong>NIK</strong> (wajib, contoh: 1005)</li>
              <li><strong>Nama</strong> (wajib, contoh: Budi Santoso)</li>
              <li><strong>Departemen</strong> (opsional, contoh: Production)</li>
              <li><strong>No_HP</strong> (opsional, contoh: 08123456789)</li>
              <li><strong>Role</strong> (employee / driver / admin / superadmin)</li>
              <li><strong>Nama_Rute</strong> (contoh: Karawang Barat / Karawang Timur / Cikampek)</li>
            </ul>
          </div>

          <div className="pt-2">
            <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl cursor-pointer bg-slate-50 hover:bg-blue-50/50 transition-all">
              <Upload className="w-8 h-8 text-blue-600 mb-2" />
              <span className="text-xs font-bold text-slate-800">
                {importing ? 'Sedang memproses Excel...' : 'Pilih File Excel (.xlsx / .xls)'}
              </span>
              <span className="text-[10px] text-slate-500 mt-1">
                Klik untuk upload dari perangkat Anda
              </span>
              <input
                type="file"
                accept=".xlsx, .xls"
                disabled={importing}
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex justify-between items-center pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              icon={<Download className="w-3.5 h-3.5 text-emerald-600" />}
            >
              Download Template
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowImportModal(false)}
            >
              Tutup
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
