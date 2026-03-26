import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ChevronLeft, Loader2, Send, Building2, Utensils, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useBoatBranding } from '@/components/guest/BoatBrandingContext';
import { generateAndUploadFeedbackPDF } from '@/lib/feedbackPdf';
import { fbt, RATING_LEVELS, DEFAULT_SECTIONS } from '@/lib/feedbackTranslations';
import { motion } from 'framer-motion';

interface Props {
  language: string;
  boatId: string;
  roomNumber: number;
  onBack: () => void;
  onSuccess: () => void;
}

const SECTION_ICONS: Record<string, React.ReactNode> = {
  Building2: <Building2 className="w-5 h-5" />,
  Utensils: <Utensils className="w-5 h-5" />,
  MessageSquare: <MessageSquare className="w-5 h-5" />,
};

const PillRating = ({
  value,
  onChange,
  lang,
}: {
  value: number;
  onChange: (v: number) => void;
  lang: string;
}) => (
  <div className="flex flex-wrap gap-2">
    {RATING_LEVELS.map((level) => {
      const selected = value === level.value;
      return (
        <motion.button
          key={level.value}
          type="button"
          whileTap={{ scale: 0.93 }}
          onClick={() => onChange(level.value)}
          className={`
            px-3 py-1.5 rounded-full text-sm font-medium transition-all border-2
            ${selected
              ? `${level.color} text-white border-transparent shadow-lg scale-105`
              : `bg-transparent ${level.borderColor} ${level.textColor} hover:opacity-80`
            }
          `}
        >
          {fbt(lang, level.key)}
        </motion.button>
      );
    })}
  </div>
);

const GuestFeedback = ({ language, boatId, roomNumber, onBack, onSuccess }: Props) => {
  const { boatName } = useBoatBranding();
  const [guestName, setGuestName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const isRtl = language === 'ar';

  const setRating = (key: string, value: number) => {
    setRatings((prev) => ({ ...prev, [key]: value }));
  };

  const setComment = (key: string, value: string) => {
    setComments((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    const hasAnyRating = Object.values(ratings).some(v => v > 0);
    if (!hasAnyRating && !comments['general']?.trim()) {
      toast({ title: 'Please provide at least one rating or comment', variant: 'destructive' });
      return;
    }

    setSending(true);

    try {
      // Translate comments to English
      const commentEntries = Object.entries(comments).filter(([, v]) => v.trim());
      let translatedComments: Record<string, string> = {};
      
      if (commentEntries.length > 0 && language !== 'en') {
        const allCommentsText = commentEntries.map(([k, v]) => `[${k}]: ${v}`).join('\n---\n');
        try {
          const res = await supabase.functions.invoke('translate', {
            body: { text: allCommentsText, sourceLang: language, targetLang: 'en' },
          });
          if (res.data?.translatedText) {
            // Parse back sections
            const parts = res.data.translatedText.split('\n---\n');
            parts.forEach((part: string) => {
              const match = part.match(/^\[(\w+)\]:\s*(.*)/s);
              if (match) translatedComments[match[1]] = match[2].trim();
            });
          }
        } catch { /* use originals */ }
      } else {
        commentEntries.forEach(([k, v]) => { translatedComments[k] = v; });
      }

      // Compute overall as average of all ratings (map 4-level to 5-level: 1→2, 2→3, 3→4, 4→5)
      const ratingValues = Object.values(ratings).filter(v => v > 0);
      const mappedOverall = ratingValues.length > 0
        ? Math.round(ratingValues.reduce((s, v) => s + (v + 1), 0) / ratingValues.length)
        : 3;

      // Map section ratings to DB columns
      const serviceItems = ['reception', 'laundry', 'housekeeping', 'cabins', 'cleanliness', 'maintenance'];
      const foodItems = ['quality', 'quantity', 'variety'];
      
      const avgOf = (keys: string[]) => {
        const vals = keys.map(k => ratings[k]).filter(Boolean);
        return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + (b + 1), 0) / vals.length) : null;
      };

      const combinedComment = Object.values(translatedComments).filter(Boolean).join(' | ');
      const originalComment = commentEntries.map(([, v]) => v).join(' | ');

      const feedbackId = crypto.randomUUID();
      const { error } = await supabase
        .from('guest_feedback' as any)
        .insert({
          id: feedbackId,
          boat_id: boatId,
          room_number: roomNumber,
          guest_language: language,
          overall_rating: mappedOverall,
          service_rating: avgOf(serviceItems),
          cleanliness_rating: ratings['cleanliness'] ? ratings['cleanliness'] + 1 : null,
          food_rating: avgOf(foodItems),
          original_comment: originalComment || null,
          translated_comment: combinedComment || null,
          guest_name: guestName.trim() || null,
          company_name: companyName.trim() || null,
        } as any);

      if (error) throw error;

      // Generate PDF (mandatory - retry up to 3 times)
      if (feedbackId) {
        const pdfData = {
          id: feedbackId,
          room_number: roomNumber,
          guest_language: language,
          overall_rating: mappedOverall,
          service_rating: avgOf(serviceItems),
          cleanliness_rating: ratings['cleanliness'] ? ratings['cleanliness'] + 1 : null,
          food_rating: avgOf(foodItems),
          original_comment: originalComment || null,
          translated_comment: combinedComment || null,
          created_at: new Date().toISOString(),
          boat_name: boatName,
          guest_name: guestName.trim() || undefined,
          company_name: companyName.trim() || undefined,
          section_ratings: ratings,
          section_comments: translatedComments,
        };

        let pdfSuccess = false;
        for (let attempt = 0; attempt < 3 && !pdfSuccess; attempt++) {
          try {
            await generateAndUploadFeedbackPDF(pdfData);
            pdfSuccess = true;
          } catch (pdfErr) {
            console.warn(`PDF attempt ${attempt + 1} failed:`, pdfErr);
            if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
          }
        }
        if (!pdfSuccess) {
          console.error('PDF generation failed after 3 attempts');
        }
      }

      onSuccess();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-primary/10 px-4 py-4 border-b border-border/30">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ChevronLeft className={`w-5 h-5 ${isRtl ? 'rotate-180' : ''}`} />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">{fbt(language, 'feedbackTitle')}</h1>
            <p className="text-xs text-muted-foreground">
              {boatName} · {fbt(language, 'room')} {roomNumber}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-5 overflow-y-auto">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Guest Info */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl p-4 border border-border/50 space-y-3"
          >
            <div>
              <label className="text-sm font-semibold text-foreground mb-1 block">
                {fbt(language, 'guestName')}
              </label>
              <Input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder={fbt(language, 'guestNamePlaceholder')}
                className="bg-background/50 text-base h-11"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground mb-1 block">
                {fbt(language, 'companyName')}
              </label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder={fbt(language, 'companyPlaceholder')}
                className="bg-background/50 text-base h-11"
              />
            </div>
          </motion.div>

          {/* Default Sections */}
          {DEFAULT_SECTIONS.map((section, sIdx) => (
            <motion.div
              key={section.key}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: sIdx * 0.08 }}
              className="bg-card rounded-xl p-4 border border-border/50"
            >
              {/* Section Header */}
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  {SECTION_ICONS[section.icon]}
                </div>
                <h2 className="text-base font-bold text-foreground">
                  {fbt(language, section.key)}
                </h2>
              </div>

              {/* Rating Items */}
              {section.items.length > 0 && (
                <div className="space-y-4">
                  {section.items.map((item) => (
                    <div key={item}>
                      <p className="text-sm font-medium text-foreground mb-2">
                        {fbt(language, item)}
                      </p>
                      <PillRating
                        value={ratings[item] || 0}
                        onChange={(v) => setRating(item, v)}
                        lang={language}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Comments */}
              {section.hasComments && (
                <div className={section.items.length > 0 ? 'mt-4 pt-3 border-t border-border/30' : ''}>
                  <p className="text-sm font-medium text-foreground mb-2">
                    {section.key === 'general' ? fbt(language, 'generalComments') : fbt(language, 'comments')}
                  </p>
                  <Textarea
                    value={comments[section.key] || ''}
                    onChange={(e) => setComment(section.key, e.target.value)}
                    placeholder={section.key === 'general' ? fbt(language, 'generalPlaceholder') : fbt(language, 'commentsPlaceholder')}
                    className="min-h-[80px] bg-background/50 border-border/50 text-base resize-none"
                    dir={isRtl ? 'rtl' : 'ltr'}
                  />
                </div>
              )}
            </motion.div>
          ))}


          {/* Submit */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Button
              onClick={handleSubmit}
              disabled={sending}
              className="w-full h-12 text-base font-semibold bg-[hsl(var(--brand-gold,45_93%_47%))] hover:bg-[hsl(var(--brand-gold,45_93%_47%)/0.9)] text-foreground"
              size="lg"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {fbt(language, 'submitting')}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  {fbt(language, 'submit')}
                </>
              )}
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default GuestFeedback;
