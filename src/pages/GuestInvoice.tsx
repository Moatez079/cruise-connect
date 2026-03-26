import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, INVOICE_CATEGORIES, getTranslatedCategory } from '@/lib/currencies';
import { t } from '@/lib/languages';
import { Anchor, ChevronLeft, Receipt, CheckCircle2, Clock } from 'lucide-react';
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
      // Check for any invoice (including draft)
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

      // If draft, show checkout message
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

      // Translate item descriptions if not English
      if (lang !== 'en' && fetchedItems.length > 0) {
        const translatedItems: TranslatedItem[] = await Promise.all(
          fetchedItems.map(async (item) => {
            try {
              const res = await supabase.functions.invoke('translate', {
                body: { text: item.description, sourceLang: 'en', targetLang: lang },
              });
              return { ...item, translatedDescription: res.data?.translatedText || item.description };
            } catch {
              return { ...item, translatedDescription: item.description };
            }
          })
        );
        setItems(translatedItems);
      } else {
        setItems(fetchedItems);
      }

      // Translate farewell
      if (lang !== 'en' && allInv.farewell_message) {
        try {
          const res = await supabase.functions.invoke('translate', {
            body: { text: allInv.farewell_message, sourceLang: 'en', targetLang: lang },
          });
          if (res.data?.translatedText) setTranslatedFarewell(res.data.translatedText);
        } catch { /* fallback */ }
      }

      setLoading(false);
    };
    fetchInvoice();
  }, [boatId, roomNumber, lang]);

  const accentStyle = primaryColor ? { color: primaryColor } : undefined;
  const accentBgLight = primaryColor ? { backgroundColor: `${primaryColor}12` } : undefined;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Show checkout message if invoice not visible yet
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

        {/* Paid Badge */}
        {isPaid && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-accent/10 border border-accent/20 mb-5">
            <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
            <span className="text-sm font-medium text-accent">{t(lang, 'invoicePaid')}</span>
          </div>
        )}

        {/* Items Table */}
        <div className="rounded-xl border border-border overflow-hidden mb-5">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-secondary/50 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <div className="col-span-6">{t(lang, 'invoiceItems')}</div>
            <div className="col-span-2 text-center">{t(lang, 'quantity')}</div>
            <div className="col-span-2 text-end">{t(lang, 'unitPrice')}</div>
            <div className="col-span-2 text-end">{t(lang, 'subtotal')}</div>
          </div>

          {/* Table Rows */}
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
