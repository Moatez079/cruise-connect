import { useEffect, useState } from 'react';
import { t } from '@/lib/languages';
import { supabase } from '@/integrations/supabase/client';
import { Anchor, ChevronLeft, ConciergeBell, GlassWater, MessageSquare, Receipt, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBoatBranding } from '@/components/guest/BoatBrandingContext';

interface Props {
  language: string;
  roomNumber: number;
  boatId: string;
  onNavigate: (view: string) => void;
  onBack: () => void;
}

const GuestMainMenu = ({ language, roomNumber, boatId, onNavigate, onBack }: Props) => {
  const [showInvoice, setShowInvoice] = useState(false);
  const { logoUrl, primaryColor, boatName } = useBoatBranding();

  useEffect(() => {
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
    { id: 'room_service', icon: ConciergeBell, label: t(language, 'roomService') },
    { id: 'drinks', icon: GlassWater, label: t(language, 'drinks') },
    { id: 'custom', icon: MessageSquare, label: t(language, 'customRequest') },
    { id: 'feedback', icon: Star, label: t(language, 'feedback') },
  ];

  const accentStyle = primaryColor ? { color: primaryColor } : undefined;
  const accentBgStyle = primaryColor
    ? { backgroundColor: `${primaryColor}15` }
    : undefined;
  const accentBorderStyle = primaryColor
    ? { borderColor: `${primaryColor}40` }
    : undefined;

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
              {logoUrl ? (
                <img src={logoUrl} alt={boatName} className="w-8 h-8 rounded-md object-contain" />
              ) : (
                <Anchor className="w-5 h-5 text-primary" style={accentStyle} />
              )}
              <h1 className="font-serif text-lg font-semibold">
                {boatName || t(language, 'welcome')}
              </h1>
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
              style={{
                ...(primaryColor ? { '--tw-ring-color': primaryColor } as any : {}),
              }}
              onMouseEnter={(e) => {
                if (accentBorderStyle) (e.currentTarget.style.borderColor = accentBorderStyle.borderColor);
                if (accentBgStyle) (e.currentTarget.style.backgroundColor = accentBgStyle.backgroundColor);
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '';
                e.currentTarget.style.backgroundColor = '';
              }}
            >
              <div
                className="p-3 rounded-lg bg-primary/10"
                style={accentBgStyle}
              >
                <item.icon className="w-6 h-6 text-primary" style={accentStyle} />
              </div>
              <span className="text-base font-medium text-foreground">{item.label}</span>
            </button>
          ))}

          {/* Invoice */}
          {showInvoice && (
            <button
              onClick={() => onNavigate('invoice')}
              className="w-full flex items-center gap-4 p-5 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-all text-left"
              style={{
                ...(accentBorderStyle || {}),
                ...(accentBgStyle || {}),
              }}
            >
              <div className="p-3 rounded-lg bg-primary/10" style={accentBgStyle}>
                <Receipt className="w-6 h-6 text-primary" style={accentStyle} />
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
