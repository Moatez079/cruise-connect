import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, INVOICE_CATEGORIES } from '@/lib/currencies';
import { t } from '@/lib/languages';
import { Anchor, Receipt } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Invoice = Tables<'invoices'>;
type InvoiceItem = Tables<'invoice_items'>;

interface TranslatedItem extends InvoiceItem {
  translatedDescription?: string;
}

const GuestInvoice = () => {
  const { boatId, roomNumber } = useParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<TranslatedItem[]>([]);
  const [boatName, setBoatName] = useState('');
  const [translatedFarewell, setTranslatedFarewell] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!boatId || !roomNumber) return;
    const fetchInvoice = async () => {
      // Find visible invoice for this room
      const { data: inv } = await supabase
        .from('invoices')
        .select('*')
        .eq('boat_id', boatId)
        .eq('room_number', parseInt(roomNumber))
        .in('status', ['visible', 'paid', 'closed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!inv) { setLoading(false); return; }
      setInvoice(inv);

      const [itemsRes, boatRes] = await Promise.all([
        supabase.from('invoice_items').select('*').eq('invoice_id', inv.id).order('created_at'),
        supabase.from('boats').select('name').eq('id', inv.boat_id).single(),
      ]);
      
      const rawItems = itemsRes.data || [];
      if (boatRes.data) setBoatName(boatRes.data.name);

      // Translate item descriptions if guest language is not English
      if (inv.guest_language !== 'en' && rawItems.length > 0) {
        const translatedItems: TranslatedItem[] = await Promise.all(
          rawItems.map(async (item) => {
            try {
              const res = await supabase.functions.invoke('translate', {
                body: { text: item.description, sourceLang: 'en', targetLang: inv.guest_language },
              });
              return { ...item, translatedDescription: res.data?.translatedText || item.description };
            } catch {
              return { ...item, translatedDescription: item.description };
            }
          })
        );
        setItems(translatedItems);
      } else {
        setItems(rawItems);
      }

      // Translate farewell
      if (inv.guest_language !== 'en' && inv.farewell_message) {
        try {
          const res = await supabase.functions.invoke('translate', {
            body: { text: inv.farewell_message, sourceLang: 'en', targetLang: inv.guest_language },
          });
          if (res.data?.translatedText) setTranslatedFarewell(res.data.translatedText);
        } catch { /* fallback english */ }
      }

      setLoading(false);
    };
    fetchInvoice();
  }, [boatId, roomNumber]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <Receipt className="w-12 h-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-center">No invoice available for this room at the moment.</p>
      </div>
    );
  }

  const total = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const farewell = translatedFarewell || invoice.farewell_message || '';
  const lang = invoice.guest_language;
  const isRTL = lang === 'ar';

  return (
    <div className="min-h-screen bg-background px-4 py-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-md mx-auto animate-fade-in">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-3">
            <Anchor className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-serif font-bold">{boatName}</h1>
          <p className="text-sm text-muted-foreground">{t(lang, 'room')} {invoice.room_number} — {t(lang, 'invoice')}</p>
        </div>

        {/* Items */}
        <div className="space-y-2 mb-6">
          {items.map(item => {
            const cat = INVOICE_CATEGORIES.find(c => c.value === item.category);
            const displayDesc = (item as TranslatedItem).translatedDescription || item.description;
            return (
              <div key={item.id} className="flex justify-between items-center p-3 rounded-lg bg-card border border-border/50">
                <div>
                  <p className="text-sm font-medium">{cat?.emoji} {displayDesc}</p>
                  <p className="text-xs text-muted-foreground">x{item.quantity}</p>
                </div>
                <p className="text-sm font-medium">{formatCurrency(item.quantity * item.unit_price, invoice.currency)}</p>
              </div>
            );
          })}
        </div>

        {/* Total */}
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-center mb-6">
          <p className="text-sm text-muted-foreground mb-1">{t(lang, 'total')}</p>
          <p className="text-3xl font-serif font-bold text-primary">
            {formatCurrency(total, invoice.currency)}
          </p>
        </div>

        {/* Farewell */}
        {farewell && (
          <div className="text-center p-4">
            <p className="text-sm italic text-foreground/70 leading-relaxed">{farewell}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GuestInvoice;
