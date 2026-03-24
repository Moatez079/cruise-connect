import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Clock, CheckCircle2, Loader2, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

type Request = Tables<'requests'>;
type Boat = Tables<'boats'>;

const statusConfig = {
  pending: { label: 'Pending', icon: Clock, className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  in_progress: { label: 'In Progress', icon: Loader2, className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  done: { label: 'Done', icon: CheckCircle2, className: 'bg-green-500/20 text-green-400 border-green-500/30' },
};

const categoryLabels: Record<string, string> = {
  towels: '🛁 Towels',
  help_opening_room: '🔑 Help Opening Room',
  cleaning: '🧹 Cleaning',
  bathroom_service: '🚿 Bathroom Service',
  do_not_disturb: '🔕 Do Not Disturb',
  drinks: '🍹 Drinks',
  custom: '💬 Custom Request',
};

const Requests = () => {
  const { toast } = useToast();
  const [requests, setRequests] = useState<Request[]>([]);
  const [boats, setBoats] = useState<Boat[]>([]);
  const [selectedBoatId, setSelectedBoatId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const { data: boatsData } = await supabase.from('boats').select('*');
    if (boatsData) setBoats(boatsData);

    let query = supabase.from('requests').select('*').order('created_at', { ascending: false });
    
    if (selectedBoatId !== 'all') {
      query = query.eq('boat_id', selectedBoatId);
    }
    if (statusFilter === 'active') {
      query = query.in('status', ['pending', 'in_progress']);
    } else if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter as any);
    }

    const { data } = await query;
    if (data) setRequests(data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [selectedBoatId, statusFilter]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('requests-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedBoatId, statusFilter]);

  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from('requests')
      .update({ status: newStatus as any })
      .eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      fetchData();
    }
  };

  const getBoatName = (boatId: string) => boats.find(b => b.id === boatId)?.name || 'Unknown';

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <DashboardLayout title="Requests" description="Live guest requests dashboard">
      <div className="space-y-6 animate-fade-in">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={selectedBoatId} onValueChange={setSelectedBoatId}>
            <SelectTrigger className="w-[180px] bg-secondary/50">
              <SelectValue placeholder="All boats" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Boats</SelectItem>
              {boats.map(b => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] bg-secondary/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="done">Done</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex-1" />
          <p className="text-sm text-muted-foreground self-center">
            {requests.length} request{requests.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Requests list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <Card className="border-dashed border-2 border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No requests yet. They will appear here in real-time.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => {
              const status = statusConfig[req.status];
              const StatusIcon = status.icon;

              return (
                <Card key={req.id} className="border-border/50 hover:border-primary/20 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <Badge variant="outline" className="text-xs">
                            Room {req.room_number}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {getBoatName(req.boat_id)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{formatTime(req.created_at)}</span>
                        </div>

                        <p className="text-sm font-medium mb-1">
                          {categoryLabels[req.category] || req.category}
                        </p>

                        {req.translated_message && (
                          <p className="text-sm text-foreground">{req.translated_message}</p>
                        )}

                        {req.original_message && req.guest_language !== 'en' && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            Original ({req.guest_language}): {req.original_message}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${status.className}`}>
                          <StatusIcon className={`w-3 h-3 ${req.status === 'in_progress' ? 'animate-spin' : ''}`} />
                          {status.label}
                        </div>

                        {req.status === 'pending' && (
                          <Button size="sm" variant="outline" onClick={() => updateStatus(req.id, 'in_progress')}>
                            Start
                          </Button>
                        )}
                        {req.status === 'in_progress' && (
                          <Button size="sm" onClick={() => updateStatus(req.id, 'done')}>
                            Done
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Requests;
