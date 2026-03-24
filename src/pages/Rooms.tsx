import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, DoorOpen, QrCode, Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import QRCode from 'react-qr-code';
import type { Tables } from '@/integrations/supabase/types';

type Room = Tables<'rooms'>;
type Boat = Tables<'boats'>;

const statusColors: Record<string, string> = {
  available: 'bg-green-500/20 text-green-400 border-green-500/30',
  occupied: 'bg-primary/20 text-primary border-primary/30',
  maintenance: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  do_not_disturb: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const Rooms = () => {
  const { user, isOwner } = useAuth();
  const { toast } = useToast();
  const [boats, setBoats] = useState<Boat[]>([]);
  const [selectedBoatId, setSelectedBoatId] = useState<string>('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [roomCount, setRoomCount] = useState('10');
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [printMode, setPrintMode] = useState(false);

  useEffect(() => {
    const fetchBoats = async () => {
      const { data } = isOwner
        ? await supabase.from('boats').select('*')
        : await supabase.from('boats').select('*');
      if (data && data.length > 0) {
        setBoats(data);
        setSelectedBoatId(data[0].id);
      }
      setLoading(false);
    };
    fetchBoats();
  }, []);

  useEffect(() => {
    if (!selectedBoatId) return;
    const fetchRooms = async () => {
      const { data } = await supabase
        .from('rooms')
        .select('*')
        .eq('boat_id', selectedBoatId)
        .order('room_number');
      if (data) setRooms(data);
    };
    fetchRooms();
  }, [selectedBoatId]);

  const generateRooms = async () => {
    const count = parseInt(roomCount);
    if (!count || count < 1 || count > 100 || !selectedBoatId) return;

    const existingNumbers = rooms.map(r => r.room_number);
    const newRooms = [];
    let num = 1;

    for (let i = 0; i < count; i++) {
      while (existingNumbers.includes(num)) num++;
      if (num > 100) break;
      const qrData = `${window.location.origin}/guest/${selectedBoatId}/${num}`;
      newRooms.push({ boat_id: selectedBoatId, room_number: num, qr_code_data: qrData });
      existingNumbers.push(num);
      num++;
    }

    const { error } = await supabase.from('rooms').insert(newRooms);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: `${newRooms.length} rooms created!` });
    setAddDialogOpen(false);

    const { data } = await supabase.from('rooms').select('*').eq('boat_id', selectedBoatId).order('room_number');
    if (data) setRooms(data);
  };

  const handlePrintAll = () => {
    setPrintMode(true);
    setTimeout(() => window.print(), 500);
    setTimeout(() => setPrintMode(false), 1000);
  };

  if (printMode) {
    return (
      <div className="p-8 bg-background" id="print-qr">
        <style>{`@media print { body { background: #fff !important; color: #000 !important; } .print-text { color: #000 !important; } .print-sub { color: #666 !important; } }`}</style>
        <h1 className="text-2xl font-serif font-bold mb-6 text-center print-text">
          QR Codes — {boats.find(b => b.id === selectedBoatId)?.name}
        </h1>
        <div className="grid grid-cols-3 gap-6">
          {rooms.map(room => (
            <div key={room.id} className="flex flex-col items-center p-4 border border-border rounded-lg print:border-gray-300">
              <QRCode value={room.qr_code_data || ''} size={120} bgColor="white" fgColor="black" />
              <p className="mt-2 text-sm font-semibold print:text-black">Room {room.room_number}</p>
              <p className="text-xs text-muted-foreground print:text-gray-600">Scan to request services</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout title="Rooms" description="Manage rooms and QR codes">
      <div className="space-y-6 animate-fade-in">
        {/* Boat selector + actions */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <Select value={selectedBoatId} onValueChange={setSelectedBoatId}>
            <SelectTrigger className="w-[200px] bg-secondary/50">
              <SelectValue placeholder="Select a boat" />
            </SelectTrigger>
            <SelectContent>
              {boats.map(b => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrintAll} disabled={rooms.length === 0}>
              <Printer className="w-4 h-4 mr-2" /> Print All QR
            </Button>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> Generate Rooms
              </Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-serif">Generate Rooms</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Number of rooms to create</Label>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={roomCount}
                      onChange={e => setRoomCount(e.target.value)}
                      className="bg-secondary/50"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Currently {rooms.length} rooms. Max 100 per boat.
                  </p>
                  <Button onClick={generateRooms} className="w-full">Generate</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Room grid */}
        {!selectedBoatId ? (
          <Card className="border-dashed border-2 border-border/50">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Select a boat to view rooms</p>
            </CardContent>
          </Card>
        ) : rooms.length === 0 ? (
          <Card className="border-dashed border-2 border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <DoorOpen className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No rooms yet. Generate rooms to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
            {rooms.map(room => (
              <button
                key={room.id}
                onClick={() => { setSelectedRoom(room); setQrDialogOpen(true); }}
                className={`aspect-square rounded-lg border flex flex-col items-center justify-center text-xs font-medium transition-all hover:scale-105 ${statusColors[room.status] || statusColors.available}`}
              >
                <span className="text-sm font-bold">{room.room_number}</span>
              </button>
            ))}
          </div>
        )}

        {/* Status legend */}
        {rooms.length > 0 && (
          <div className="flex gap-4 flex-wrap text-xs">
            {Object.entries(statusColors).map(([status, cls]) => (
              <div key={status} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-sm border ${cls}`} />
                <span className="text-muted-foreground capitalize">{status.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        )}

        {/* QR Dialog */}
        <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-serif">Room {selectedRoom?.room_number} — QR Code</DialogTitle>
            </DialogHeader>
            {selectedRoom?.qr_code_data && (
              <div className="flex flex-col items-center py-6">
                <div className="p-4 bg-white rounded-xl">
                  <QRCode value={selectedRoom.qr_code_data} size={200} />
                </div>
                <p className="mt-4 text-sm text-muted-foreground">Scan to request services</p>
                <p className="mt-1 text-xs text-muted-foreground/60 break-all">{selectedRoom.qr_code_data}</p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Rooms;
