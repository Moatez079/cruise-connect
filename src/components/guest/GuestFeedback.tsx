import { useState, useEffect } from 'react';
import { t } from '@/lib/languages';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, Loader2, Send, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateAndUploadFeedbackPDF } from '@/lib/feedbackPdf';

interface Props {
  language: string;
  boatId: string;
  roomNumber: number;
  onBack: () => void;
  onSuccess: () => void;
}

interface FeedbackQuestion {
  id: string;
  label: string;
  label_en: string;
  question_type: string;
  required: boolean;
  sort_order: number;
  label_translated?: string;
}

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

const defaultCategories = [
  { key: 'overall', labelKey: 'overallRating', required: true },
  { key: 'service', labelKey: 'serviceRating', required: false },
  { key: 'cleanliness', labelKey: 'cleanlinessRating', required: false },
  { key: 'food', labelKey: 'foodRating', required: false },
];

const GuestFeedback = ({ language, boatId, roomNumber, onBack, onSuccess }: Props) => {
  const [ratings, setRatings] = useState<Record<string, number>>({ overall: 0, service: 0, cleanliness: 0, food: 0 });
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [customQuestions, setCustomQuestions] = useState<FeedbackQuestion[]>([]);
  const [customRatings, setCustomRatings] = useState<Record<string, number>>({});
  const [customTexts, setCustomTexts] = useState<Record<string, string>>({});
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchAndTranslateQuestions = async () => {
      const { data } = await (supabase.from('feedback_questions' as any) as any)
        .select('*')
        .eq('boat_id', boatId)
        .order('sort_order');

      if (data && data.length > 0) {
        const questions = data as FeedbackQuestion[];

        // If guest language is not English, translate question labels
        if (language !== 'en') {
          const translatedQuestions = await Promise.all(
            questions.map(async (q) => {
              try {
                const res = await supabase.functions.invoke('translate', {
                  body: { text: q.label_en, sourceLang: 'en', targetLang: language },
                });
                return { ...q, label_translated: res.data?.translatedText || q.label_en };
              } catch {
                return { ...q, label_translated: q.label_en };
              }
            })
          );
          setCustomQuestions(translatedQuestions);
        } else {
          setCustomQuestions(questions.map(q => ({ ...q, label_translated: q.label_en })));
        }
      }
      setLoadingQuestions(false);
    };
    fetchAndTranslateQuestions();
  }, [boatId, language]);

  const hasCustomForm = customQuestions.length > 0;

  const setRating = (key: string, value: number) => {
    setRatings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (ratings.overall === 0) {
      toast({ title: t(language, 'ratingRequired'), variant: 'destructive' });
      return;
    }

    // Validate required custom questions
    if (hasCustomForm) {
      for (const q of customQuestions) {
        if (q.required) {
          if (q.question_type === 'rating' && (!customRatings[q.id] || customRatings[q.id] === 0)) {
            toast({ title: `${q.label_translated || q.label_en} is required`, variant: 'destructive' });
            return;
          }
          if (q.question_type === 'text' && (!customTexts[q.id] || !customTexts[q.id].trim())) {
            toast({ title: `${q.label_translated || q.label_en} is required`, variant: 'destructive' });
            return;
          }
        }
      }
    }

    setSending(true);

    try {
      let translatedComment = comment || null;

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

      // Insert custom answers
      if (feedbackId && hasCustomForm) {
        const answersToInsert = customQuestions
          .filter(q => customRatings[q.id] || customTexts[q.id])
          .map(q => ({
            feedback_id: feedbackId,
            question_id: q.id,
            rating_value: q.question_type === 'rating' ? (customRatings[q.id] || null) : null,
            text_value: q.question_type === 'text' ? (customTexts[q.id] || null) : null,
          }));

        if (answersToInsert.length > 0) {
          await (supabase.from('feedback_answers' as any) as any).insert(answersToInsert);
        }
      }

      // Generate PDF
      if (feedbackId) {
        try {
          await generateAndUploadPDF(feedbackId, translatedComment);
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

  const generateAndUploadPDF = async (feedbackId: string, translatedComment: string | null) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(26, 54, 93); // navy
    doc.text('Guest Feedback Report', pageWidth / 2, y, { align: 'center' });
    y += 12;

    // Divider
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.5);
    doc.line(20, y, pageWidth - 20, y);
    y += 10;

    // Info
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    doc.text(`Room: ${roomNumber}`, 20, y);
    doc.text(`Date: ${new Date().toLocaleDateString('en-US')}`, pageWidth - 20, y, { align: 'right' });
    y += 8;
    doc.text(`Language: ${language.toUpperCase()}`, 20, y);
    y += 12;

    // Ratings section
    doc.setFontSize(14);
    doc.setTextColor(26, 54, 93);
    doc.text('Ratings', 20, y);
    y += 8;

    const ratingStars = (n: number) => '\u2605'.repeat(n) + '\u2606'.repeat(5 - n);

    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);

    const ratingItems: { label: string; value: number }[] = [
      { label: 'Overall', value: ratings.overall },
    ];
    if (ratings.service) ratingItems.push({ label: 'Service', value: ratings.service });
    if (ratings.cleanliness) ratingItems.push({ label: 'Cleanliness', value: ratings.cleanliness });
    if (ratings.food) ratingItems.push({ label: 'Food', value: ratings.food });

    for (const item of ratingItems) {
      doc.text(`${item.label}: ${ratingStars(item.value)}  (${item.value}/5)`, 25, y);
      y += 7;
    }
    y += 5;

    // Custom questions
    if (hasCustomForm) {
      doc.setFontSize(14);
      doc.setTextColor(26, 54, 93);
      doc.text('Additional Questions', 20, y);
      y += 8;

      doc.setFontSize(11);
      doc.setTextColor(60, 60, 60);

      for (const q of customQuestions) {
        if (y > 260) {
          doc.addPage();
          y = 20;
        }
        if (q.question_type === 'rating' && customRatings[q.id]) {
          doc.text(`${q.label_en}: ${ratingStars(customRatings[q.id])}  (${customRatings[q.id]}/5)`, 25, y);
          y += 7;
        } else if (q.question_type === 'text' && customTexts[q.id]) {
          doc.text(`${q.label_en}:`, 25, y);
          y += 6;
          const lines = doc.splitTextToSize(customTexts[q.id], pageWidth - 55);
          doc.text(lines, 30, y);
          y += lines.length * 6 + 3;
        }
      }
      y += 5;
    }

    // Comment
    const commentText = translatedComment || comment.trim();
    if (commentText) {
      if (y > 240) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(14);
      doc.setTextColor(26, 54, 93);
      doc.text('Guest Comment', 20, y);
      y += 8;

      doc.setFontSize(11);
      doc.setTextColor(60, 60, 60);
      const commentLines = doc.splitTextToSize(commentText, pageWidth - 50);
      doc.text(commentLines, 25, y);
    }

    // Upload
    const pdfBlob = doc.output('blob');
    const fileName = `feedback_${feedbackId}_room${roomNumber}_${Date.now()}.pdf`;

    const { error } = await supabase.storage
      .from('feedback-pdfs')
      .upload(fileName, pdfBlob, { contentType: 'application/pdf' });
    if (error) throw error;

    await (supabase.from('guest_feedback' as any) as any)
      .update({ pdf_path: fileName })
      .eq('id', feedbackId);
  };

  if (loadingQuestions) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col px-4 py-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-md mx-auto animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className={`w-5 h-5 ${language === 'ar' ? 'rotate-180' : ''}`} />
          </Button>
          <h1 className="font-serif text-lg font-semibold">{t(language, 'feedback')}</h1>
        </div>

        <div className="space-y-6">
          {/* Default rating categories (always shown) */}
          {defaultCategories.map((cat) => (
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

          {/* Custom questions - translated to guest language */}
          {hasCustomForm && (
            <>
              <div className="border-t border-border/30 pt-4">
                <p className="text-xs text-muted-foreground mb-4">{t(language, 'additionalQuestions') || 'Additional Questions'}</p>
              </div>
              {customQuestions.map((q) => (
                <div key={q.id} className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {q.label_translated || q.label_en}
                    {q.required && <span className="text-destructive ml-1">*</span>}
                  </label>
                  {q.question_type === 'rating' ? (
                    <StarRating
                      value={customRatings[q.id] || 0}
                      onChange={(v) => setCustomRatings(prev => ({ ...prev, [q.id]: v }))}
                    />
                  ) : (
                    <Textarea
                      value={customTexts[q.id] || ''}
                      onChange={(e) => setCustomTexts(prev => ({ ...prev, [q.id]: e.target.value }))}
                      className="min-h-[80px] bg-card border-border/50 text-base resize-none"
                      dir={language === 'ar' ? 'rtl' : 'ltr'}
                    />
                  )}
                </div>
              ))}
            </>
          )}

          {/* Comment */}
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
