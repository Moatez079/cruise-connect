import { useState } from 'react';
import { t } from '@/lib/languages';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  language: string;
  boatId: string;
  roomNumber: number;
  onBack: () => void;
  onSuccess: () => void;
}

const serviceItems = [
  { key: 'towels', category: 'towels' as const, emoji: '🛁' },
  { key: 'helpOpeningRoom', category: 'help_opening_room' as const, emoji: '🔑' },
  { key: 'cleaning', category: 'cleaning' as const, emoji: '🧹' },
  { key: 'bathroomService', category: 'bathroom_service' as const, emoji: '🚿' },
  { key: 'doNotDisturb', category: 'do_not_disturb' as const, emoji: '🔕' },
];

const GuestRoomService = ({ language, boatId, roomNumber, onBack, onSuccess }: Props) => {
  const [sending, setSending] = useState<string | null>(null);
  const { toast } = useToast();

  const handleRequest = async (category: string, labelKey: string) => {
    setSending(category);
    try {
      // Translate the service name to English if needed
      let translatedMessage = t('en', labelKey);

      if (language !== 'en') {
        try {
          const res = await supabase.functions.invoke('translate', {
            body: {
              text: t(language, labelKey),
              sourceLang: language,
              targetLang: 'en',
            },
          });
          if (res.data?.translatedText) {
            translatedMessage = res.data.translatedText;
          }
        } catch {
          // Use English fallback
        }
      }

      const { error } = await supabase.from('requests').insert({
        boat_id: boatId,
        room_number: roomNumber,
        category: category as any,
        original_message: t(language, labelKey),
        translated_message: translatedMessage,
        guest_language: language,
      });

      if (error) throw error;
      onSuccess();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col px-4 py-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-md mx-auto animate-fade-in">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className={`w-5 h-5 ${language === 'ar' ? 'rotate-180' : ''}`} />
          </Button>
          <h1 className="font-serif text-lg font-semibold">{t(language, 'roomService')}</h1>
        </div>

        <div className="space-y-3">
          {serviceItems.map((item) => (
            <button
              key={item.category}
              onClick={() => handleRequest(item.category, item.key)}
              disabled={sending !== null}
              className="w-full flex items-center gap-4 p-5 rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:bg-primary/5 transition-all text-left disabled:opacity-50"
            >
              <span className="text-2xl">{item.emoji}</span>
              <span className="flex-1 text-base font-medium text-foreground">
                {t(language, item.key)}
              </span>
              {sending === item.category && (
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GuestRoomService;
