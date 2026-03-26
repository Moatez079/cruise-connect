import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';

interface FeedbackData {
  id: string;
  room_number: number;
  guest_language: string;
  overall_rating: number;
  service_rating: number | null;
  cleanliness_rating: number | null;
  food_rating: number | null;
  original_comment: string | null;
  translated_comment: string | null;
  created_at: string;
  boat_name?: string;
}

interface CustomAnswer {
  question_label: string;
  question_type: string;
  rating_value: number | null;
  text_value: string | null;
}

const ratingStars = (n: number) => '\u2605'.repeat(n) + '\u2606'.repeat(5 - n);

export const generateFeedbackPDF = (feedback: FeedbackData, customAnswers: CustomAnswer[] = []): jsPDF => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header
  doc.setFontSize(20);
  doc.setTextColor(26, 54, 93);
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
  doc.text(`Room: ${feedback.room_number}`, 20, y);
  doc.text(`Date: ${new Date(feedback.created_at).toLocaleDateString('en-US')}`, pageWidth - 20, y, { align: 'right' });
  y += 8;
  doc.text(`Language: ${feedback.guest_language.toUpperCase()}`, 20, y);
  if (feedback.boat_name) {
    doc.text(`Vessel: ${feedback.boat_name}`, pageWidth - 20, y, { align: 'right' });
  }
  y += 12;

  // Ratings
  doc.setFontSize(14);
  doc.setTextColor(26, 54, 93);
  doc.text('Ratings', 20, y);
  y += 8;

  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);

  const ratingItems: { label: string; value: number }[] = [
    { label: 'Overall', value: feedback.overall_rating },
  ];
  if (feedback.service_rating) ratingItems.push({ label: 'Service', value: feedback.service_rating });
  if (feedback.cleanliness_rating) ratingItems.push({ label: 'Cleanliness', value: feedback.cleanliness_rating });
  if (feedback.food_rating) ratingItems.push({ label: 'Food & Beverage', value: feedback.food_rating });

  for (const item of ratingItems) {
    doc.text(`${item.label}: ${ratingStars(item.value)}  (${item.value}/5)`, 25, y);
    y += 7;
  }
  y += 5;

  // Custom answers
  if (customAnswers.length > 0) {
    doc.setFontSize(14);
    doc.setTextColor(26, 54, 93);
    doc.text('Additional Questions', 20, y);
    y += 8;

    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);

    for (const a of customAnswers) {
      if (y > 260) { doc.addPage(); y = 20; }
      if (a.question_type === 'rating' && a.rating_value) {
        doc.text(`${a.question_label}: ${ratingStars(a.rating_value)}  (${a.rating_value}/5)`, 25, y);
        y += 7;
      } else if (a.question_type === 'text' && a.text_value) {
        doc.text(`${a.question_label}:`, 25, y);
        y += 6;
        const lines = doc.splitTextToSize(a.text_value, pageWidth - 55);
        doc.text(lines, 30, y);
        y += lines.length * 6 + 3;
      }
    }
    y += 5;
  }

  // Comment
  const commentText = feedback.translated_comment || feedback.original_comment;
  if (commentText) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.setTextColor(26, 54, 93);
    doc.text('Guest Comment', 20, y);
    y += 8;

    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    const commentLines = doc.splitTextToSize(commentText, pageWidth - 50);
    doc.text(commentLines, 25, y);
  }

  return doc;
};

export const generateAndUploadFeedbackPDF = async (
  feedback: FeedbackData,
  customAnswers: CustomAnswer[] = []
): Promise<string> => {
  const doc = generateFeedbackPDF(feedback, customAnswers);
  const pdfBlob = doc.output('blob');
  const fileName = `feedback_${feedback.id}_room${feedback.room_number}_${Date.now()}.pdf`;

  const { error } = await supabase.storage
    .from('feedback-pdfs')
    .upload(fileName, pdfBlob, { contentType: 'application/pdf' });
  if (error) throw error;

  await (supabase.from('guest_feedback' as any) as any)
    .update({ pdf_path: fileName })
    .eq('id', feedback.id);

  return fileName;
};
