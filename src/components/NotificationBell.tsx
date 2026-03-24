import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface Notification {
  id: string;
  roomNumber: number;
  category: string;
  boatId: string;
  boatName?: string;
  message?: string;
  createdAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  towels: 'Towels',
  help_opening_room: 'Help Opening Room',
  cleaning: 'Cleaning',
  bathroom_service: 'Bathroom Service',
  do_not_disturb: 'Do Not Disturb',
  drinks: 'Drinks',
  custom: 'Custom Request',
};

const NotificationBell = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const boatNamesRef = useRef<Record<string, string>>({});
  const { toast } = useToast();

  // Fetch boat names for display
  useEffect(() => {
    const fetchBoats = async () => {
      const { data } = await supabase.from('boats').select('id, name');
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((b) => (map[b.id] = b.name));
        boatNamesRef.current = map;
      }
    };
    fetchBoats();
  }, []);

  // Subscribe to realtime inserts on requests
  useEffect(() => {
    const channel = supabase
      .channel('new-requests')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'requests',
        },
        (payload) => {
          const req = payload.new as any;
          const notification: Notification = {
            id: req.id,
            roomNumber: req.room_number,
            category: req.category,
            boatId: req.boat_id,
            boatName: boatNamesRef.current[req.boat_id] || '',
            message: req.translated_message || req.original_message || undefined,
            createdAt: req.created_at,
          };

          setNotifications((prev) => [notification, ...prev].slice(0, 20));
          setUnreadCount((prev) => prev + 1);

          // Show toast
          toast({
            title: `🔔 Room ${req.room_number} — ${CATEGORY_LABELS[req.category] || req.category}`,
            description: notification.message
              ? notification.message.slice(0, 80)
              : `New ${CATEGORY_LABELS[req.category] || 'request'} from Room ${req.room_number}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) setUnreadCount(0);
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-destructive text-destructive-foreground animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="px-4 py-3 border-b border-border/50">
          <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
          <p className="text-xs text-muted-foreground">Live guest request alerts</p>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell className="w-8 h-8 mx-auto text-muted-foreground/20 mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground/70">New requests will appear here in real-time</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className="px-4 py-3 border-b border-border/30 last:border-b-0 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      Room {n.roomNumber} — {CATEGORY_LABELS[n.category] || n.category}
                    </p>
                    {n.boatName && (
                      <p className="text-xs text-muted-foreground">{n.boatName}</p>
                    )}
                    {n.message && (
                      <p className="text-xs text-muted-foreground/80 mt-1 truncate">
                        {n.message}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
                    {formatTime(n.createdAt)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
