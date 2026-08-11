import { useState, useEffect } from 'react';
import { Dialog } from '../ui/Dialog';
import { LiveMap, type MarkerLocation } from '../maps/LiveMap';
import { supabase } from '../../lib/supabase';
import type { DriverLocation } from '../../lib/types';
import { Phone, RefreshCw, AlertCircle, ShieldCheck } from 'lucide-react';

interface PassengerLiveTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  routeName: string;
  routeId: string;
  assignedDriverName?: string;
  assignedDriverPhone?: string;
}

const DEFAULT_STATIONS: Record<string, [number, number]> = {
  'Karawang Barat 1': [-6.276592879810661, 107.27324066001847],
  'Karawang Barat 2': [-6.276592879810661, 107.27324066001847],
  'Karawang Barat': [-6.276592879810661, 107.27324066001847],
  'Karawang Timur': [-6.2830973278683935, 107.45715106568662],
  'Cikampek': [-6.370380867733877, 107.37704813870378],
};

export function PassengerLiveTrackerModal({
  isOpen,
  onClose,
  routeName,
  routeId,
  assignedDriverName,
  assignedDriverPhone,
}: PassengerLiveTrackerModalProps) {
  const [driverLoc, setDriverLoc] = useState<DriverLocation | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDriverLocation = async () => {
    setLoading(true);
    try {
      // Fetch latest active location for driver assigned to this route or latest active driver
      let { data } = await supabase
        .from('driver_locations')
        .select('*, driver:employees(name, nik, phone)')
        .eq('route_id', routeId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) {
        // Fallback: get any active driver location
        const { data: fallbackData } = await supabase
          .from('driver_locations')
          .select('*, driver:employees(name, nik, phone)')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        data = fallbackData;
      }

      if (data) setDriverLoc(data as any);
    } catch (e) {
      console.log('Error fetching live driver location:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDriverLocation();
      const interval = setInterval(fetchDriverLocation, 5000); // Live poll every 5s
      return () => clearInterval(interval);
    }
  }, [isOpen, routeId]);

  const mapCenter: [number, number] = driverLoc
    ? [driverLoc.latitude, driverLoc.longitude]
    : DEFAULT_STATIONS[routeName] || [-6.3039, 107.3009];

  const mapMarkers: MarkerLocation[] = [];

  if (driverLoc) {
    mapMarkers.push({
      id: driverLoc.id,
      title: `Driver ${(driverLoc as any).driver?.name || 'Armada Shuttle'}`,
      subtitle: `Rute: ${routeName}`,
      lat: driverLoc.latitude,
      lng: driverLoc.longitude,
      type: 'driver',
      status: driverLoc.status.replace(/_/g, ' '),
    });
  }

  // Add station marker
  const stationCoords = DEFAULT_STATIONS[routeName];
  if (stationCoords) {
    mapMarkers.push({
      id: `station-${routeName}`,
      title: `Halte ${routeName}`,
      subtitle: 'Titik Penjemputan Anda',
      lat: stationCoords[0],
      lng: stationCoords[1],
      type: 'station',
    });
  }

  const displayDriverName = assignedDriverName || (driverLoc as any)?.driver?.name || 'Driver Shuttle';
  const displayDriverPhone = assignedDriverPhone || (driverLoc as any)?.driver?.phone || '081299992001';

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="🚌 Real-Time Live Tracking Shuttle">
      <div className="space-y-4">
        {/* Status Header */}
        {(() => {
          const isOnline = driverLoc && ['active', 'heading_to_pickup', 'in_transit'].includes(driverLoc.status);
          return (
            <div
              className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                isOnline
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isOnline ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'
                  }`}
                />
                <span className="text-xs font-bold">
                  {isOnline
                    ? `🟢 Live Online (${driverLoc?.status.replace(/_/g, ' ')})`
                    : driverLoc
                    ? `⚪ Driver Offline (${driverLoc.status})`
                    : '⚪ Driver Belum Membuka Sesi Perjalanan'}
                </span>
              </div>
              <button
                onClick={fetchDriverLocation}
                className="p-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-slate-700 cursor-pointer"
                title="Refresh Lokasi Driver"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          );
        })()}

        {/* Live Leaflet Map */}
        <LiveMap
          center={mapCenter}
          zoom={14}
          markers={mapMarkers}
          className="h-64 w-full rounded-xl overflow-hidden border border-surface-200 dark:border-surface-800 shadow-inner"
        />

        {/* Driver Card Info (Gojek Style) */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow">
              🚌
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1">
                {displayDriverName}
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              </h4>
              <p className="text-[11px] text-slate-600">
                Rute: {routeName} {driverLoc ? `• Update: ${new Date(driverLoc.updated_at).toLocaleTimeString('id-ID')} WIB` : ''}
              </p>
            </div>
          </div>

          <a
            href={`https://wa.me/${displayDriverPhone.replace(/[^0-9]/g, '')}`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 shadow-md transition-colors"
          >
            <Phone className="w-3.5 h-3.5" /> WA Driver
          </a>
        </div>


        <div className="text-[10px] text-slate-500 text-center">
          * Posisi driver diperbarui secara real-time dari konsol GPS driver.
        </div>
      </div>
    </Dialog>
  );
}
