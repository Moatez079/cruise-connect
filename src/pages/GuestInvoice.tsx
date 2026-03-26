import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, INVOICE_CATEGORIES, getTranslatedCategory } from '@/lib/currencies';
import { t } from '@/lib/languages';
import { Anchor, ChevronLeft, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBoatBranding } from '@/components/guest/BoatBrandingContext';
import type { Tables } from '@/integrations/supabase/types';

type Invoice = Tables<'invoices'>;
type InvoiceItem = Tables<'invoice_items'>;

interface TranslatedItem extends InvoiceItem {
  translatedDescription?: string;
}

interface Props {
  language: string;
  onBack?: () => void;
}

const SEPARATOR = ' ||| ';

const GuestInvoice = ({ language, onBack }: Props) => {
  const { boatId, roomNumber } = useParams();
  const { logoUrl, primaryColor, boatName } = useBoatBranding();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<TranslatedItem[]>([]);
  const [translatedFarewell, setTranslatedFarewell] = useState('');
  const [loading, setLoading] = useState(true);
  const [notVisible, setNotVisible] = useState(false);

  const lang = language || 'en';
  const isRTL = lang === 'ar';

  useEffect(() => {
    if (!boatId || !roomNumber) return;
    const fetchInvoice = async () => {
      const { data: allInv } = await supabase
        .from('invoices')
        .select('*')
        .eq('boat_id', boatId)
        .eq('room_number', parseInt(roomNumber))
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!allInv) {
        setNotVisible(true);
        setLoading(false);
        return;
      }

      if (allInv.status === 'draft') {
        setNotVisible(true);
        setLoading(false);
        return;
      }

      setInvoice(allInv);

      const { data: rawItems } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', allInv.id)
        .order('created_at');

      const fetchedItems = rawItems || [];

      // Batch translate: combine all descriptions + farewell in one call
      if (lang !== 'en' && fetchedItems.length > 0) {
        const allTexts = fetchedItems.map(i => i.description);
        if (allInv.farewell_message) allTexts.push(allInv.farewell_message);

        const combinedText = allTexts.join(SEPARATOR);

        try {
          const res = await supabase.functions.invoke('translate', {
            body: { text: combinedText, sourceLang: 'en', targetLang: lang },
          });

          if (res.data?.translatedText) {
            const parts = res.data.translatedText.split(SEPARATOR.trim());
            const translatedItems: TranslatedItem[] = fetchedItems.map((item, idx) => ({
              ...item,
              translatedDescription: parts[idx]?.trim() || item.description,
            }));
            setItems(translatedItems);

            // Last part is farewell if it was included
            if (allInv.farewell_message && parts.length > fetchedItems.length) {
              setTranslatedFarewell(parts[parts.length - 1]?.trim() || '');
            }
          } else {
            setItems(fetchedItems);
          }
        } catch {
          console.warn('Batch translation failed, showing original');
          setItems(fetchedItems);
        }
      } else {
        setItems(fetchedItems);

        // Translate farewell only
        if (lang !== 'en' && allInv.farewell_message) {
          try {
            const res = await supabase.functions.invoke('translate', {
              body: { text: allInv.farewell_message, sourceLang: 'en', targetLang: lang },
            });
            if (res.data?.translatedText) setTranslatedFarewell(res.data.translatedText);
          } catch { /* fallback */ }
        }
      }

      setLoading(false);
    };
    fetchInvoice();
  }, [boatId, roomNumber, lang]);

  // Realtime: listen for invoice status changes
  useEffect(() => {
    if (!invoice?.id) return;

    const channel = supabase
      .channel(`invoice-status-${invoice.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'invoices',
          filter: `id=eq.${invoice.id}`,
        },
        (payload) => {
          const updated = payload.new as Invoice;
          setInvoice(updated);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [invoice?.id]);

  const accentStyle = primaryColor ? { color: primaryColor } : undefined;
  const accentBgLight = primaryColor ? { backgroundColor: `${primaryColor}12` } : undefined;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notVisible) {
    return (
      <div className="min-h-screen flex flex-col bg-background px-4 py-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="w-full max-w-md mx-auto animate-fade-in">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="mb-4 text-muted-foreground">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          )}
          <div className="flex flex-col items-center justify-center flex-1 py-16">
            <div className="p-4 rounded-full bg-primary/10 mb-6" style={accentBgLight}>
              <Clock className="w-10 h-10 text-primary" style={accentStyle} />
            </div>
            <h2 className="text-lg font-serif font-semibold text-foreground mb-3 text-center">
              {t(lang, 'invoice')}
            </h2>
            <p className="text-sm text-muted-foreground text-center leading-relaxed max-w-xs">
              {t(lang, 'invoiceCheckout')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!invoice) return null;

  const total = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const farewell = translatedFarewell || invoice.farewell_message || '';
  const isPaid = invoice.status === 'paid' || invoice.status === 'closed';
  const statusLabel = isPaid
    ? t(lang, 'invoicePaid')
    : invoice.status === 'visible'
    ? t(lang, 'invoicePending') || 'Pending Payment'
    : '';

  return (
    <div className="min-h-screen bg-background px-4 py-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-md mx-auto animate-fade-in">
        {/* Back + Header */}
        <div className="flex items-center gap-3 mb-6">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="text-muted-foreground">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {logoUrl ? (
                <img src={logoUrl} alt={boatName} className="w-8 h-8 rounded-md object-contain" />
              ) : (
                <Anchor className="w-5 h-5 text-primary" style={accentStyle} />
              )}
              <h1 className="font-serif text-lg font-semibold">{boatName}</h1>
            </div>
            <p className="text-xs text-muted-foreground">
              {t(lang, 'room')} {invoice.room_number} — {t(lang, 'invoice')}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        {isPaid ? (
          <div className="flex items-center gap-2 p-3 rounded-xl mb-5"
            style={{ backgroundColor: '#dcfce7', border: '1px solid #86efac' }}>
            <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: '#16a34a' }} />
            <span className="text-sm font-medium" style={{ color: '#15803d' }}>{statusLabel}</span>
          </div>
        ) : invoice.status === 'visible' && (
          <div className="flex items-center gap-2 p-3 rounded-xl mb-5"
            style={{ backgroundColor: '#fef9c3', border: '1px solid #fde047' }}>
            <Clock className="w-5 h-5 shrink-0" style={{ color: '#a16207' }} />
            <span className="text-sm font-medium" style={{ color: '#854d0e' }}>{statusLabel}</span>
          </div>
        )}

        {/* Items Table */}
        <div className="rounded-xl border border-border overflow-hidden mb-5">
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-secondary/50 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <div className="col-span-6">{t(lang, 'invoiceItems')}</div>
            <div className="col-span-2 text-center">{t(lang, 'quantity')}</div>
            <div className="col-span-2 text-end">{t(lang, 'unitPrice')}</div>
            <div className="col-span-2 text-end">{t(lang, 'subtotal')}</div>
          </div>

          {items.map((item, idx) => {
            const cat = INVOICE_CATEGORIES.find(c => c.value === item.category);
            const displayDesc = (item as TranslatedItem).translatedDescription || item.description;
            const translatedCatLabel = getTranslatedCategory(item.category, lang);
            const lineTotal = item.quantity * item.unit_price;
            return (
              <div
                key={item.id}
                className={`grid grid-cols-12 gap-2 px-4 py-3 items-center ${
                  idx < items.length - 1 ? 'border-b border-border/50' : ''
                }`}
              >
                <div className="col-span-6">
                  <p className="text-sm font-medium text-foreground">
                    {cat?.emoji} {displayDesc}
                  </p>
                  <p className="text-xs text-muted-foreground">{translatedCatLabel}</p>
                </div>
                <div className="col-span-2 text-center text-sm text-muted-foreground">
                  {item.quantity}
                </div>
                <div className="col-span-2 text-end text-sm text-muted-foreground">
                  {formatCurrency(item.unit_price, invoice.currency)}
                </div>
                <div className="col-span-2 text-end text-sm font-medium text-foreground">
                  {formatCurrency(lineTotal, invoice.currency)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Total */}
        <div className="p-5 rounded-xl border border-primary/20 mb-6" style={accentBgLight}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">{t(lang, 'total')}</span>
            <span className="text-2xl font-serif font-bold text-primary" style={accentStyle}>
              {formatCurrency(total, invoice.currency)}
            </span>
          </div>
        </div>

        {/* Farewell */}
        {farewell && (
          <div className="text-center px-4 pb-6">
            <p className="text-sm italic text-foreground/60 leading-relaxed">{farewell}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GuestInvoice;
