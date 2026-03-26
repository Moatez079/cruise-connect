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
  guest_name?: string;
  company_name?: string;
  section_ratings?: Record<string, number>;
  section_comments?: Record<string, string>;
}

interface CustomAnswer {
  question_label: string;
  question_type: string;
  rating_value: number | null;
  text_value: string | null;
}

const RATING_LABELS: Record<number, { label: string; color: [number, number, number] }> = {
  4: { label: 'Excellent', color: [34, 139, 34] },
  3: { label: 'Very Good', color: [59, 130, 246] },
  2: { label: 'Good', color: [234, 138, 0] },
  1: { label: 'Fair', color: [220, 53, 69] },
};

const SECTION_ITEMS: Record<string, { title: string; items: { key: string; label: string }[] }> = {
  services: {
    title: 'Services',
    items: [
      { key: 'reception', label: 'Reception' },
      { key: 'laundry', label: 'Laundry' },
      { key: 'housekeeping', label: 'Housekeeping' },
      { key: 'cabins', label: 'Cabins' },
      { key: 'cleanliness', label: 'Cleanliness' },
      { key: 'maintenance', label: 'Maintenance' },
    ],
  },
  facilities: {
    title: 'Facilities',
    items: [
      { key: 'restaurant', label: 'Restaurant' },
      { key: 'loungeBar', label: 'Lounge Bar' },
      { key: 'sundeckBar', label: 'Sundeck Bar' },
      { key: 'swimmingPool', label: 'Swimming Pool' },
    ],
  },
  food: {
    title: 'Food',
    items: [
      { key: 'quality', label: 'Quality' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'variety', label: 'Variety' },
    ],
  },
};

export const generateFeedbackPDF = (feedback: FeedbackData, customAnswers: CustomAnswer[] = []): jsPDF => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // --- Header ---
  doc.setFillColor(26, 54, 93);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(feedback.boat_name || 'Cruise Ship', pageWidth / 2, 18, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Guest Feedback Report', pageWidth / 2, 27, { align: 'center' });

  doc.setFontSize(9);
  doc.text(new Date(feedback.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), pageWidth / 2, 35, { align: 'center' });

  y = 50;

  // --- Guest Info Box ---
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(15, y, pageWidth - 30, feedback.company_name ? 28 : 20, 3, 3, 'F');

  doc.setTextColor(60, 60, 60);
  doc.setFontSize(10);
  const infoY = y + 8;
  doc.setFont('helvetica', 'bold');
  doc.text('Room:', 20, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${feedback.room_number}`, 38, infoY);

  if (feedback.guest_name) {
    doc.setFont('helvetica', 'bold');
    doc.text('Guest:', 70, infoY);
    doc.setFont('helvetica', 'normal');
    doc.text(feedback.guest_name, 90, infoY);
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Language:', pageWidth - 55, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(feedback.guest_language.toUpperCase(), pageWidth - 28, infoY);

  if (feedback.company_name) {
    const compY = infoY + 10;
    doc.setFont('helvetica', 'bold');
    doc.text('Company:', 20, compY);
    doc.setFont('helvetica', 'normal');
    doc.text(feedback.company_name, 48, compY);
  }

  y += feedback.company_name ? 36 : 28;

  // --- Section Ratings ---
  const sectionRatings = feedback.section_ratings || {};
  const sectionComments = feedback.section_comments || {};

  for (const [sectionKey, section] of Object.entries(SECTION_ITEMS)) {
    const sectionItemRatings = section.items.filter(item => sectionRatings[item.key]);
    const comment = sectionComments[sectionKey];
    if (sectionItemRatings.length === 0 && !comment) continue;

    if (y > 250) { doc.addPage(); y = 20; }

    // Section title
    doc.setFillColor(26, 54, 93);
    doc.rect(15, y, 3, 8, 'F');
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 54, 93);
    doc.text(section.title, 22, y + 6);
    y += 14;

    // Rating items
    for (const item of section.items) {
      const val = sectionRatings[item.key];
      if (!val) continue;
      if (y > 270) { doc.addPage(); y = 20; }

      const ratingInfo = RATING_LABELS[val] || { label: `${val}/4`, color: [100, 100, 100] as [number, number, number] };

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(item.label, 25, y);

      // Colored dot
      doc.setFillColor(...ratingInfo.color);
      doc.circle(120, y - 1.5, 2.5, 'F');

      // Rating label
      doc.setTextColor(...ratingInfo.color);
      doc.setFont('helvetica', 'bold');
      doc.text(ratingInfo.label, 126, y);

      y += 7;
    }

    // Section comment
    if (comment) {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      const commentLines = doc.splitTextToSize(`"${comment}"`, pageWidth - 55);
      doc.text(commentLines, 25, y);
      y += commentLines.length * 5 + 2;
    }

    y += 6;
  }

  // --- Custom Answers ---
  if (customAnswers.length > 0) {
    if (y > 250) { doc.addPage(); y = 20; }

    doc.setFillColor(26, 54, 93);
    doc.rect(15, y, 3, 8, 'F');
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 54, 93);
    doc.text('Additional Questions', 22, y + 6);
    y += 14;

    for (const a of customAnswers) {
      if (y > 265) { doc.addPage(); y = 20; }
      if (a.question_type === 'rating' && a.rating_value) {
        const ratingInfo = RATING_LABELS[a.rating_value] || { label: `${a.rating_value}/4`, color: [100, 100, 100] as [number, number, number] };
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text(a.question_label, 25, y);
        doc.setFillColor(...ratingInfo.color);
        doc.circle(120, y - 1.5, 2.5, 'F');
        doc.setTextColor(...ratingInfo.color);
        doc.setFont('helvetica', 'bold');
        doc.text(ratingInfo.label, 126, y);
        y += 7;
      } else if (a.question_type === 'text' && a.text_value) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(80, 80, 80);
        doc.text(`${a.question_label}:`, 25, y);
        y += 6;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        const lines = doc.splitTextToSize(a.text_value, pageWidth - 55);
        doc.text(lines, 30, y);
        y += lines.length * 5 + 3;
      }
    }
    y += 6;
  }

  // --- General Comment (fallback for old data) ---
  if (!feedback.section_ratings) {
    const commentText = feedback.translated_comment || feedback.original_comment;
    if (commentText) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFillColor(26, 54, 93);
      doc.rect(15, y, 3, 8, 'F');
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 54, 93);
      doc.text('Guest Comment', 22, y + 6);
      y += 14;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      const commentLines = doc.splitTextToSize(commentText, pageWidth - 50);
      doc.text(commentLines, 25, y);
      y += commentLines.length * 5.5;
    }

    // Legacy ratings display
    const ratingItems: { label: string; value: number }[] = [
      { label: 'Overall', value: feedback.overall_rating },
    ];
    if (feedback.service_rating) ratingItems.push({ label: 'Service', value: feedback.service_rating });
    if (feedback.cleanliness_rating) ratingItems.push({ label: 'Cleanliness', value: feedback.cleanliness_rating });
    if (feedback.food_rating) ratingItems.push({ label: 'Food & Beverage', value: feedback.food_rating });

    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFillColor(26, 54, 93);
    doc.rect(15, y, 3, 8, 'F');
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 54, 93);
    doc.text('Ratings', 22, y + 6);
    y += 14;

    for (const item of ratingItems) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(item.label, 25, y);
      const stars = '\u2605'.repeat(item.value) + '\u2606'.repeat(5 - item.value);
      doc.text(`${stars}  (${item.value}/5)`, 80, y);
      y += 7;
    }
  }

  // --- Footer ---
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(15, footerY - 5, pageWidth - 15, footerY - 5);
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.setFont('helvetica', 'italic');
  doc.text('Thank you for your feedback', pageWidth / 2, footerY, { align: 'center' });

  return doc;
};

export const generateAndUploadFeedbackPDF = async (
  feedback: FeedbackData,
  customAnswers: CustomAnswer[] = []
): Promise<string> => {
  const doc = generateFeedbackPDF(feedback, customAnswers);
  const pdfBlob = doc.output('blob');
  const fileName = feedback.boat_name 
    ? `${feedback.boat_name.replace(/\s+/g, '_')}/${Date.now()}_room${feedback.room_number}.pdf`
    : `feedback_${feedback.id}_room${feedback.room_number}_${Date.now()}.pdf`;

  const { error } = await supabase.storage
    .from('feedback-pdfs')
    .upload(fileName, pdfBlob, { contentType: 'application/pdf' });
  if (error) throw error;

  await (supabase.from('guest_feedback' as any) as any)
    .update({ pdf_path: fileName })
    .eq('id', feedback.id);

  return fileName;
};
