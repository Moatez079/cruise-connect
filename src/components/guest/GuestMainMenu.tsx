import { useEffect, useState } from 'react';
import { t } from '@/lib/languages';
import { supabase } from '@/integrations/supabase/client';
import { Anchor, ChevronLeft, ConciergeBell, GlassWater, MessageSquare, Receipt, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  language: string;
  roomNumber: number;
  boatId: string;
  onNavigate: (view: string) => void;
  onBack: () => void;
}

const GuestMainMenu = ({ language, roomNumber, boatId, onNavigate, onBack }: Props) => {
  const [showInvoice, setShowInvoice] = useState(false);

  useEffect(() => {
    // Check if invoice is visible for this room
    const checkInvoice = async () => {
      const { data } = await supabase
        .from('invoices')
        .select('id')
        .eq('boat_id', boatId)
        .eq('room_number', roomNumber)
        .in('status', ['visible', 'paid', 'closed'])
        .limit(1);
      if (data && data.length > 0) setShowInvoice(true);
    };
    checkInvoice();
  }, [boatId, roomNumber]);

  const menuItems = [
    { id: 'room_service', icon: ConciergeBell, label: t(language, 'roomService'), color: 'text-primary' },
    { id: 'drinks', icon: GlassWater, label: t(language, 'drinks'), color: 'text-primary' },
    { id: 'custom', icon: MessageSquare, label: t(language, 'customRequest'), color: 'text-primary' },
    { id: 'feedback', icon: Star, label: t(language, 'feedback'), color: 'text-primary' },
  ];

  return (
    <div className="min-h-screen flex flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={onBack} className="text-muted-foreground">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Anchor className="w-5 h-5 text-primary" />
              <h1 className="font-serif text-lg font-semibold">{t(language, 'welcome')}</h1>
            </div>
            <p className="text-xs text-muted-foreground">{t(language, 'room')} {roomNumber}</p>
          </div>
        </div>

        {/* Menu items */}
        <div className="space-y-3">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="w-full flex items-center gap-4 p-5 rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:bg-primary/5 transition-all text-left"
            >
              <div className="p-3 rounded-lg bg-primary/10">
                <item.icon className={`w-6 h-6 ${item.color}`} />
              </div>
              <span className="text-base font-medium text-foreground">{item.label}</span>
            </button>
          ))}

          {/* Invoice - only shown when enabled by reception */}
          {showInvoice && (
            <button
              onClick={() => onNavigate('invoice')}
              className="w-full flex items-center gap-4 p-5 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-all text-left"
            >
              <div className="p-3 rounded-lg bg-primary/10">
                <Receipt className="w-6 h-6 text-primary" />
              </div>
              <span className="text-base font-medium text-foreground">{t(language, 'invoice')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GuestMainMenu;
