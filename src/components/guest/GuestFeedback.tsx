import { useState } from 'react';
import { t } from '@/lib/languages';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, Loader2, Send, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  language: string;
  boatId: string;
  roomNumber: number;
  onBack: () => void;
  onSuccess: () => void;
}

const ratingCategories = [
  { key: 'overall', labelKey: 'overallRating', required: true },
  { key: 'service', labelKey: 'serviceRating', required: false },
  { key: 'cleanliness', labelKey: 'cleanlinessRating', required: false },
  { key: 'food', labelKey: 'foodRating', required: false },
];

const StarRating = ({ value, onChange, size = 28 }: { value: number; onChange: (v: number) => void; size?: number }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        type="button"
        onClick={() => onChange(star)}
        className="transition-transform hover:scale-110 active:scale-95"
      >
        <Star
          className={`transition-colors ${star <= value ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/30'}`}
          style={{ width: size, height: size }}
        />
      </button>
    ))}
  </div>
);

const GuestFeedback = ({ language, boatId, roomNumber, onBack, onSuccess }: Props) => {
  const [ratings, setRatings] = useState<Record<string, number>>({ overall: 0, service: 0, cleanliness: 0, food: 0 });
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const setRating = (key: string, value: number) => {
    setRatings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (ratings.overall === 0) {
      toast({ title: t(language, 'ratingRequired'), variant: 'destructive' });
      return;
    }
    setSending(true);

    try {
      let translatedComment = comment || null;

      // Translate comment if not English and has content
      if (comment.trim() && language !== 'en') {
        try {
          const res = await supabase.functions.invoke('translate', {
            body: { text: comment, sourceLang: language, targetLang: 'en' },
          });
          if (res.data?.translatedText) {
            translatedComment = res.data.translatedText;
          }
        } catch (err) {
          console.warn('Translation failed, using original:', err);
        }
      }

      // Insert feedback
      const { data: feedback, error } = await supabase
        .from('guest_feedback' as any)
        .insert({
          boat_id: boatId,
          room_number: roomNumber,
          guest_language: language,
          overall_rating: ratings.overall,
          service_rating: ratings.service || null,
          cleanliness_rating: ratings.cleanliness || null,
          food_rating: ratings.food || null,
          original_comment: comment.trim() || null,
          translated_comment: translatedComment,
        } as any)
        .select('id')
        .single();

      if (error) throw error;

      const feedbackId = (feedback as any)?.id;

      if (error) throw error;

      // Generate and upload PDF
      if (feedbackId) {
        try {
          await generateAndUploadPDF(feedbackId);
        } catch (pdfErr) {
          console.warn('PDF generation failed:', pdfErr);
        }
      }

      onSuccess();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const generateAndUploadPDF = async (feedbackId: string) => {
    // Build a simple HTML-based PDF content
    const ratingStars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);
    const html = `
      <div style="font-family:Helvetica,Arial,sans-serif;padding:40px;max-width:600px;margin:0 auto;">
        <h1 style="color:#1a365d;border-bottom:2px solid #2563eb;padding-bottom:12px;">Guest Feedback</h1>
        <p><strong>Room:</strong> ${roomNumber}</p>
        <p><strong>Language:</strong> ${language.toUpperCase()}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        <hr style="margin:20px 0;border-color:#e2e8f0;">
        <h2 style="color:#2563eb;">Ratings</h2>
        <p><strong>Overall:</strong> ${ratingStars(ratings.overall)} (${ratings.overall}/5)</p>
        ${ratings.service ? `<p><strong>Service:</strong> ${ratingStars(ratings.service)} (${ratings.service}/5)</p>` : ''}
        ${ratings.cleanliness ? `<p><strong>Cleanliness:</strong> ${ratingStars(ratings.cleanliness)} (${ratings.cleanliness}/5)</p>` : ''}
        ${ratings.food ? `<p><strong>Food:</strong> ${ratingStars(ratings.food)} (${ratings.food}/5)</p>` : ''}
        ${comment.trim() ? `
          <hr style="margin:20px 0;border-color:#e2e8f0;">
          <h2 style="color:#2563eb;">Guest Comment</h2>
          <p style="background:#f7fafc;padding:16px;border-radius:8px;border-left:4px solid #2563eb;">${comment}</p>
        ` : ''}
      </div>
    `;

    // Convert HTML to a Blob (simple text/html PDF approach)
    const blob = new Blob([`<html><body>${html}</body></html>`], { type: 'text/html' });
    const fileName = `feedback_${feedbackId}_room${roomNumber}_${Date.now()}.html`;

    const { error } = await supabase.storage
      .from('feedback-pdfs')
      .upload(fileName, blob, { contentType: 'text/html' });

    if (error) throw error;

    // Update feedback record with PDF path
    await (supabase.from('guest_feedback' as any) as any)
      .update({ pdf_path: fileName })
      .eq('id', feedbackId);
  };

  return (
    <div className="min-h-screen flex flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-serif text-lg font-semibold">{t(language, 'feedback')}</h1>
        </div>

        <div className="space-y-6">
          {ratingCategories.map((cat) => (
            <div key={cat.key} className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t(language, cat.labelKey)}
                {cat.required && <span className="text-destructive ml-1">*</span>}
              </label>
              <StarRating
                value={ratings[cat.key]}
                onChange={(v) => setRating(cat.key, v)}
              />
            </div>
          ))}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t(language, 'feedbackComment')}
            </label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t(language, 'feedbackPlaceholder')}
              className="min-h-[120px] bg-card border-border/50 text-base resize-none"
              dir={language === 'ar' ? 'rtl' : 'ltr'}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={ratings.overall === 0 || sending}
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
                {t(language, 'submitFeedback')}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GuestFeedback;
