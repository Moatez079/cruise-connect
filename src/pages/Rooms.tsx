import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, DoorOpen, Printer, Pencil, BedDouble, Crown, Loader2, RefreshCw, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useBoats } from '@/hooks/useBoats';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import QRCode from 'react-qr-code';
import type { Tables } from '@/integrations/supabase/types';

type Room = Tables<'rooms'>;

const statusColors: Record<string, string> = {
  available: 'bg-green-500/20 text-green-400 border-green-500/30',
  occupied: 'bg-primary/20 text-primary border-primary/30',
  maintenance: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  do_not_disturb: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const roomTypeLabels: Record<string, string> = { room: 'Room', suite: 'Suite' };
const bedTypeLabels: Record<string, string> = { king: 'King Size', twin: 'Twin Bed' };
const PUBLISHED_GUEST_APP_ORIGIN = 'https://cruises-connect.lovable.app';

const generateToken = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let token = '';
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 12; i++) token += chars[arr[i] % chars.length];
  return token;
};

const Rooms = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: boats = [], isLoading: boatsLoading } = useBoats();
  const [selectedBoatId, setSelectedBoatId] = useState<string>('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [roomCount, setRoomCount] = useState('10');
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [printMode, setPrintMode] = useState(false);
  const [editingRoom, setEditingRoom] = useState(false);
  const [newRoomNumber, setNewRoomNumber] = useState('');
  const [newRoomType, setNewRoomType] = useState<string>('room');
  const [newBedType, setNewBedType] = useState<string>('king');
  const [regenDialogOpen, setRegenDialogOpen] = useState(false);
  const [customDomain, setCustomDomain] = useState(PUBLISHED_GUEST_APP_ORIGIN);

  // Auto-select first boat
  const effectiveBoatId = selectedBoatId || boats[0]?.id || '';

  const { data: rooms = [], isLoading: roomsLoading } = useQuery({
    queryKey: ['rooms', effectiveBoatId],
    queryFn: async () => {
      if (!effectiveBoatId) return [];
      const { data, error } = await supabase.from('rooms').select('*').eq('boat_id', effectiveBoatId).order('room_number');
      if (error) throw error;
      return data as Room[];
    },
    enabled: !!effectiveBoatId,
  });

  const generateRoomsMutation = useMutation({
    mutationFn: async () => {
      const count = parseInt(roomCount);
      if (!count || count < 1 || count > 100 || !effectiveBoatId) throw new Error('Invalid');
      const existingNumbers = rooms.map(r => r.room_number);
      const newRooms = [];
      let num = 1;
      for (let i = 0; i < count; i++) {
        while (existingNumbers.includes(num)) num++;
        if (num > 9999) break;
        const token = generateToken();
        const domain = customDomain.replace(/\/+$/, '');
        const qrData = `${domain}/guest/t/${token}`;
        newRooms.push({ boat_id: effectiveBoatId, room_number: num, qr_code_data: qrData, qr_token: token } as any);
        existingNumbers.push(num);
        num++;
      }
      const { error } = await supabase.from('rooms').insert(newRooms);
      if (error) throw error;
      return newRooms.length;
    },
    onSuccess: (count) => {
      toast({ title: `${count} rooms created!` });
      setAddDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['rooms', effectiveBoatId] });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const saveRoomMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRoom) throw new Error('No room');
      const num = parseInt(newRoomNumber);
      if (!num || num < 1) throw new Error('Invalid room number');
      if (rooms.some(r => r.id !== selectedRoom.id && r.room_number === num)) throw new Error('Room number already exists');
      const token = (selectedRoom as any).qr_token || generateToken();
      const domain = customDomain.replace(/\/+$/, '');
      const qrData = `${domain}/guest/t/${token}`;
      const { error } = await supabase.from('rooms').update({
        room_number: num, qr_code_data: qrData, room_type: newRoomType as any, bed_type: newBedType as any, qr_token: token,
      }).eq('id', selectedRoom.id);
      if (error) throw error;
      return { num, qrData };
    },
    onSuccess: ({ num, qrData }) => {
      toast({ title: 'Room updated successfully' });
      setSelectedRoom({ ...selectedRoom!, room_number: num, qr_code_data: qrData, room_type: newRoomType as any, bed_type: newBedType as any });
      setEditingRoom(false);
      queryClient.invalidateQueries({ queryKey: ['rooms', effectiveBoatId] });
    },
    onError: (err: any) => toast({ title: err.message, variant: 'destructive' }),
  });

  const regenerateAllMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveBoatId || rooms.length === 0) throw new Error('No rooms');
      const domain = customDomain.replace(/\/+$/, '');
      let updated = 0;
      for (const room of rooms) {
        const token = generateToken();
        const qrData = `${domain}/guest/t/${token}`;
        const { error } = await supabase.from('rooms').update({
          qr_code_data: qrData, qr_token: token,
        } as any).eq('id', room.id);
        if (error) throw error;
        updated++;
      }
      return updated;
    },
    onSuccess: (count) => {
      toast({ title: `${count} QR codes regenerated!` });
      setRegenDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['rooms', effectiveBoatId] });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const handlePrintAll = () => {
    setPrintMode(true);
    setTimeout(() => window.print(), 500);
    setTimeout(() => setPrintMode(false), 1000);
  };

  const openRoomDialog = (room: Room) => {
    setSelectedRoom(room);
    setNewRoomNumber(String(room.room_number));
    setNewRoomType(room.room_type || 'room');
    setNewBedType(room.bed_type || 'king');
    setEditingRoom(false);
    setQrDialogOpen(true);
  };

  if (printMode) {
    return (
      <div className="p-8 bg-background" id="print-qr">
        <style>{`@media print { body { background: #fff !important; color: #000 !important; } }`}</style>
        <h1 className="text-2xl font-serif font-bold mb-6 text-center">
          QR Codes — {boats.find(b => b.id === effectiveBoatId)?.name}
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

  const loading = boatsLoading || roomsLoading;

  return (
    <DashboardLayout title="Rooms" description="Manage rooms and QR codes">
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <Select value={effectiveBoatId} onValueChange={setSelectedBoatId}>
            <SelectTrigger className="w-[200px] bg-secondary/50"><SelectValue placeholder="Select a boat" /></SelectTrigger>
            <SelectContent>
              {boats.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrintAll} disabled={rooms.length === 0}>
              <Printer className="w-4 h-4 mr-2" /> Print All QR
            </Button>
            <Button variant="outline" onClick={() => setRegenDialogOpen(true)} disabled={rooms.length === 0}>
              <RefreshCw className="w-4 h-4 mr-2" /> Regenerate QR
            </Button>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <Button onClick={() => setAddDialogOpen(true)}><Plus className="w-4 h-4 mr-2" /> Generate Rooms</Button>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-serif">Generate Rooms</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Number of rooms to create</Label>
                    <Input type="number" min="1" max="100" value={roomCount} onChange={e => setRoomCount(e.target.value)} className="bg-secondary/50" />
                  </div>
                  <p className="text-xs text-muted-foreground">Currently {rooms.length} rooms.</p>
                  <Button onClick={() => generateRoomsMutation.mutate()} className="w-full" disabled={generateRoomsMutation.isPending}>
                    {generateRoomsMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Generate
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {loading ? (
          <PageSkeleton.Cards count={20} />
        ) : !effectiveBoatId ? (
          <Card className="border-dashed border-2 border-border/50">
            <CardContent className="py-12 text-center"><p className="text-muted-foreground">Select a boat to view rooms</p></CardContent>
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
                onClick={() => openRoomDialog(room)}
                className={`aspect-square rounded-lg border flex flex-col items-center justify-center text-xs font-medium transition-all hover:scale-105 ${statusColors[room.status] || statusColors.available}`}
              >
                <span className="text-sm font-bold">{room.room_number}</span>
                {room.room_type === 'suite' && <Crown className="w-3 h-3 mt-0.5 text-primary" />}
              </button>
            ))}
          </div>
        )}

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

        <Dialog open={qrDialogOpen} onOpenChange={(open) => { setQrDialogOpen(open); if (!open) setEditingRoom(false); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-serif flex items-center gap-2">
                Room {selectedRoom?.room_number}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingRoom(true)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </DialogTitle>
            </DialogHeader>
            {selectedRoom && !editingRoom && (
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/60 text-sm">
                  <Crown className="w-3.5 h-3.5 text-primary" />{roomTypeLabels[selectedRoom.room_type] || 'Room'}
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/60 text-sm">
                  <BedDouble className="w-3.5 h-3.5 text-primary" />{bedTypeLabels[selectedRoom.bed_type] || 'King Size'}
                </div>
              </div>
            )}
            {editingRoom && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>Room Number</Label>
                  <Input type="number" min="1" value={newRoomNumber} onChange={e => setNewRoomNumber(e.target.value)} className="bg-secondary/50" />
                </div>
                <div className="space-y-1">
                  <Label>Room Type</Label>
                  <Select value={newRoomType} onValueChange={setNewRoomType}>
                    <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="room">Room</SelectItem>
                      <SelectItem value="suite">Suite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Bed Type</Label>
                  <Select value={newBedType} onValueChange={setNewBedType}>
                    <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="king">King Size</SelectItem>
                      <SelectItem value="twin">Twin Bed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => saveRoomMutation.mutate()} className="flex-1" disabled={saveRoomMutation.isPending}>Save</Button>
                  <Button variant="ghost" onClick={() => setEditingRoom(false)}>Cancel</Button>
                </div>
              </div>
            )}
            {selectedRoom?.qr_code_data && (
              <div className="flex flex-col items-center py-4">
                <div className="p-4 bg-white rounded-xl">
                  <QRCode value={selectedRoom.qr_code_data} size={180} />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">Scan to request services</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => {
                  const printWindow = window.open('', '_blank');
                  if (!printWindow) return;
                  printWindow.document.write(`
                    <html><head><title>Room ${selectedRoom.room_number}</title>
                    <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:serif;}
                    p{margin:8px 0;font-size:14px;}</style></head><body>
                    <div id="qr"></div>
                    <p style="font-size:20px;font-weight:bold;">Room ${selectedRoom.room_number}</p>
                    <p>Scan to request services</p>
                    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"><\/script>
                    <script>
                      var canvas = document.createElement('canvas');
                      QRCode.toCanvas(canvas, '${selectedRoom.qr_code_data}', {width:250,margin:2}, function(){
                        document.getElementById('qr').appendChild(canvas);
                        setTimeout(function(){window.print();window.close();},500);
                      });
                    <\/script></body></html>
                  `);
                  printWindow.document.close();
                }}>
                  <Printer className="w-4 h-4 mr-2" /> Print QR
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={regenDialogOpen} onOpenChange={setRegenDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-serif flex items-center gap-2"><Globe className="w-5 h-5" /> Regenerate All QR Codes</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Domain (base URL)</Label>
                <Input value={customDomain} onChange={e => setCustomDomain(e.target.value)} placeholder="https://yourdomain.com" className="bg-secondary/50" />
                <p className="text-xs text-muted-foreground">QR links will be: {customDomain.replace(/\/+$/, '')}/guest/t/[secure-token]</p>
              </div>
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm text-destructive">⚠️ This will regenerate ALL {rooms.length} QR codes with new secure tokens. Old printed QR codes will stop working.</p>
              </div>
              <Button onClick={() => regenerateAllMutation.mutate()} className="w-full" disabled={regenerateAllMutation.isPending || !customDomain.trim()}>
                {regenerateAllMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Regenerate {rooms.length} QR Codes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Rooms;
