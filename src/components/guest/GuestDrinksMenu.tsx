import { useState, useEffect } from 'react';
import { t } from '@/lib/languages';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Loader2, ShoppingCart, Plus, Minus, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useBoatBranding } from '@/components/guest/BoatBrandingContext';

interface Props {
  language: string;
  boatId: string;
  roomNumber: number;
  onBack: () => void;
  onSuccess: () => void;
}

interface MenuItem {
  id: string;
  name: string;
  name_ar: string | null;
  price: number;
  category: string;
  available: boolean;
}

const CATEGORY_EMOJIS: Record<string, string> = {
  hot_drinks: '☕',
  cold_drinks: '🧊',
  juices: '🧃',
  cocktails: '🍹',
  beer: '🍺',
  wine: '🍷',
  spirits: '🥃',
  soft_drinks: '🥤',
  other: '🍽️',
};

const GuestDrinksMenu = ({ language, boatId, roomNumber, onBack, onSuccess }: Props) => {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [sending, setSending] = useState(false);
  const { toast } = useToast();
  const { primaryColor } = useBoatBranding();

  useEffect(() => {
    const fetchMenu = async () => {
      const { data } = await (supabase.from('menu_items' as any) as any)
        .select('*')
        .eq('boat_id', boatId)
        .eq('available', true)
        .order('category')
        .order('sort_order', { ascending: true });
      setItems((data as MenuItem[]) || []);
      setLoading(false);
    };
    fetchMenu();
  }, [boatId]);

  const addToCart = (id: string) => {
    setCart(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => {
      const val = (prev[id] || 0) - 1;
      if (val <= 0) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: val };
    });
  };

  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);

  const handleOrder = async () => {
    if (totalItems === 0) return;
    setSending(true);

    try {
      // Build order message
      const orderLines = Object.entries(cart).map(([id, qty]) => {
        const item = items.find(i => i.id === id);
        return item ? `${qty}x ${item.name}` : '';
      }).filter(Boolean);

      const message = `Drinks order:\n${orderLines.join('\n')}`;

      const { error } = await supabase.from('requests').insert({
        boat_id: boatId,
        room_number: roomNumber,
        category: 'drinks' as any,
        original_message: message,
        translated_message: message,
        guest_language: language,
      });

      if (error) throw error;
      setCart({});
      onSuccess();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  // Group items by category
  const grouped = items.reduce<Record<string, MenuItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const getItemName = (item: MenuItem) => {
    if (language === 'ar' && item.name_ar) return item.name_ar;
    return item.name;
  };

  return (
    <div className="min-h-screen flex flex-col px-4 py-6 pb-24">
      <div className="w-full max-w-md mx-auto animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-serif text-lg font-semibold">{t(language, 'drinks')}</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No drinks available at the moment.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([category, categoryItems]) => (
              <div key={category}>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span>{CATEGORY_EMOJIS[category] || '🍽️'}</span>
                  <span>{category.replace(/_/g, ' ')}</span>
                </h2>
                <div className="space-y-2">
                  {categoryItems.map(item => {
                    const qty = cart[item.id] || 0;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-card"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                            {getItemName(item)}
                          </p>
                          {item.price > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5">${item.price}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {qty > 0 && (
                            <>
                              <button
                                onClick={() => removeFromCart(item.id)}
                                className="w-8 h-8 rounded-full flex items-center justify-center border border-border hover:bg-muted transition-colors"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-6 text-center text-sm font-semibold">{qty}</span>
                            </>
                          )}
                          <button
                            onClick={() => addToCart(item.id)}
                            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors text-primary-foreground"
                            style={{ backgroundColor: primaryColor || undefined }}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating order button */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t border-border/50">
          <div className="max-w-md mx-auto">
            <Button
              onClick={handleOrder}
              disabled={sending}
              className="w-full h-12 text-base"
              size="lg"
              style={{ backgroundColor: primaryColor || undefined }}
            >
              {sending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t(language, 'sending')}</>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  {t(language, 'sendRequest')} ({totalItems})
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuestDrinksMenu;
