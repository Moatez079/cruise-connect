import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, getCurrencySymbol, INVOICE_CATEGORIES } from '@/lib/currencies';
import { Anchor } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Invoice = Tables<'invoices'>;
type InvoiceItem = Tables<'invoice_items'>;

const InvoicePrint = () => {
  const { invoiceId } = useParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [boatName, setBoatName] = useState('');
  const [translatedFarewell, setTranslatedFarewell] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!invoiceId) return;
    const fetchData = async () => {
      const { data: inv } = await supabase.from('invoices').select('*').eq('id', invoiceId).single();
      if (!inv) { setLoading(false); return; }
      setInvoice(inv);

      const [itemsRes, boatRes, settingsRes] = await Promise.all([
        supabase.from('invoice_items').select('*').eq('invoice_id', inv.id).order('created_at'),
        supabase.from('boats').select('name').eq('id', inv.boat_id).single(),
        (supabase.from('boat_settings' as any) as any).select('farewell_message, logo_url').eq('boat_id', inv.boat_id).maybeSingle(),
      ]);
      if (itemsRes.data) setItems(itemsRes.data);
      if (boatRes.data) setBoatName(boatRes.data.name);

      // Use boat_settings farewell if available, otherwise fall back to invoice's own
      const settings = settingsRes.data as { farewell_message?: string; logo_url?: string } | null;
      if (settings?.logo_url) setLogoUrl(settings.logo_url);
      const farewellSource = settings?.farewell_message || inv.farewell_message;

      // Translate farewell message if not English
      if (inv.guest_language !== 'en' && farewellSource) {
        try {
          const res = await supabase.functions.invoke('translate', {
            body: { text: farewellSource, sourceLang: 'en', targetLang: inv.guest_language },
          });
          if (res.data?.translatedText) {
            setTranslatedFarewell(res.data.translatedText);
          }
        } catch {
          // Fallback to English
        }
      } else if (farewellSource && farewellSource !== inv.farewell_message) {
        // English but using settings message instead of invoice default
        setTranslatedFarewell(farewellSource);
      }

      setLoading(false);
      setTimeout(() => window.print(), 800);
    };
    fetchData();
  }, [invoiceId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Invoice not found</p>
      </div>
    );
  }

  const total = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const farewell = translatedFarewell || invoice.farewell_message || '';

  return (
    <>
      <style>{`
        @media print {
          body { background: white !important; color: #111827 !important; -webkit-print-color-adjust: exact; }
          .no-print { display: none !important; }
          * { color: #111827 !important; }
          .print-muted { color: #4b5563 !important; }
          .print-accent { color: #92400e !important; }
        }
        @media screen {
          body { background: #f9fafb !important; }
        }
      `}</style>

      <div className="max-w-2xl mx-auto p-8" style={{ background: 'white', color: '#111827' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8 pb-6" style={{ borderBottom: '1px solid #e5e7eb' }}>
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={boatName} className="w-12 h-12 rounded-lg object-contain" />
            ) : (
              <div className="p-2 rounded-lg" style={{ backgroundColor: '#fef3c7' }}>
                <Anchor className="w-8 h-8" style={{ color: '#92400e' }} />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-serif font-bold" style={{ color: '#111827' }}>
                {boatName || 'Floating Hotel'}
              </h1>
              <p className="text-sm" style={{ color: '#6b7280' }}>Guest Invoice</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium" style={{ color: '#111827' }}>
              Room {invoice.room_number}
            </p>
            <p className="text-xs" style={{ color: '#6b7280' }}>
              {new Date(invoice.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Items table */}
        <table className="w-full mb-8">
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              <th className="text-left py-3 text-sm font-medium" style={{ color: '#4b5563' }}>Item</th>
              <th className="text-left py-3 text-sm font-medium" style={{ color: '#4b5563' }}>Description</th>
              <th className="text-right py-3 text-sm font-medium" style={{ color: '#4b5563' }}>Qty</th>
              <th className="text-right py-3 text-sm font-medium" style={{ color: '#4b5563' }}>Price</th>
              <th className="text-right py-3 text-sm font-medium" style={{ color: '#4b5563' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const cat = INVOICE_CATEGORIES.find(c => c.value === item.category);
              return (
                <tr key={item.id} style={idx < items.length - 1 ? { borderBottom: '1px solid #f3f4f6' } : undefined}>
                  <td className="py-3 text-sm" style={{ color: '#111827' }}>{cat?.emoji} {cat?.label || item.category}</td>
                  <td className="py-3 text-sm" style={{ color: '#111827' }}>{item.description}</td>
                  <td className="py-3 text-sm text-right" style={{ color: '#111827' }}>{item.quantity}</td>
                  <td className="py-3 text-sm text-right" style={{ color: '#111827' }}>{formatCurrency(item.unit_price, invoice.currency)}</td>
                  <td className="py-3 text-sm text-right font-medium" style={{ color: '#111827' }}>{formatCurrency(item.quantity * item.unit_price, invoice.currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Total */}
        <div className="flex justify-end mb-10 pt-4" style={{ borderTop: '2px solid #d97706' }}>
          <div className="text-right">
            <p className="text-sm" style={{ color: '#4b5563' }}>Total Amount</p>
            <p className="text-3xl font-serif font-bold" style={{ color: '#92400e' }}>
              {formatCurrency(total, invoice.currency)}
            </p>
          </div>
        </div>

        {/* Farewell message */}
        {farewell && (
          <div
            className="text-center p-6 rounded-xl"
            style={{ backgroundColor: '#fef9ee', border: '1px solid #fde68a' }}
            dir={invoice.guest_language === 'ar' ? 'rtl' : 'ltr'}
          >
            <p className="text-sm italic leading-relaxed" style={{ color: '#374151' }}>
              {farewell}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-4 text-center" style={{ borderTop: '1px solid #e5e7eb' }}>
          <p className="text-xs" style={{ color: '#6b7280' }}>
            {boatName} • Generated on {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </>
  );
};

export default InvoicePrint;
