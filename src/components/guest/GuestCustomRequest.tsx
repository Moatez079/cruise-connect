import { useState } from 'react';
import { t } from '@/lib/languages';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, Loader2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  language: string;
  boatId: string;
  roomNumber: number;
  onBack: () => void;
  onSuccess: () => void;
}

const GuestCustomRequest = ({ language, boatId, roomNumber, onBack, onSuccess }: Props) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);

    try {
      let translatedMessage = message;

      if (language !== 'en') {
        try {
          const res = await supabase.functions.invoke('translate', {
            body: {
              text: message,
              sourceLang: language,
              targetLang: 'en',
            },
          });

          if (res.data?.translatedText) {
            translatedMessage = res.data.translatedText;

            // Log translation
            await supabase.from('translation_logs').insert({
              original_text: message,
              translated_text: translatedMessage,
              source_language: language,
              target_language: 'en',
              provider: res.data.provider || 'unknown',
              confidence_score: res.data.confidence || null,
            });
          }
        } catch (err) {
          console.warn('Translation failed, sending original:', err);
        }
      }

      const { error } = await supabase.from('requests').insert({
        boat_id: boatId,
        room_number: roomNumber,
        category: 'custom' as any,
        original_message: message,
        translated_message: translatedMessage,
        guest_language: language,
      });

      if (error) throw error;
      onSuccess();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col px-4 py-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-md mx-auto animate-fade-in">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className={`w-5 h-5 ${language === 'ar' ? 'rotate-180' : ''}`} />
          </Button>
          <h1 className="font-serif text-lg font-semibold">{t(language, 'customRequest')}</h1>
        </div>

        <div className="space-y-4">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t(language, 'writeYourRequest')}
            className="min-h-[150px] bg-card border-border/50 text-base resize-none"
            dir={language === 'ar' ? 'rtl' : 'ltr'}
          />

          <Button
            onClick={handleSend}
            disabled={!message.trim() || sending}
            className="w-full"
            size="lg"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t(language, 'sending')}
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                {t(language, 'sendRequest')}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GuestCustomRequest;
