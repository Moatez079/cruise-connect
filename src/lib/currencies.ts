export const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
];

export const INVOICE_CATEGORIES = [
  { value: 'restaurant', label: 'Restaurant', emoji: '🍽️' },
  { value: 'bar', label: 'Bar', emoji: '🍸' },
  { value: 'massage', label: 'Massage & Spa', emoji: '💆' },
  { value: 'internet', label: 'Internet', emoji: '📶' },
  { value: 'room_service', label: 'Room Service', emoji: '🛎️' },
  { value: 'custom', label: 'Custom', emoji: '📝' },
];

// Translated category labels for guest-facing views
export const INVOICE_CATEGORY_TRANSLATIONS: Record<string, Record<string, string>> = {
  en: { restaurant: 'Restaurant', bar: 'Bar', massage: 'Massage & Spa', internet: 'Internet', room_service: 'Room Service', custom: 'Custom' },
  ar: { restaurant: 'مطعم', bar: 'بار', massage: 'مساج وسبا', internet: 'إنترنت', room_service: 'خدمة الغرف', custom: 'أخرى' },
  fr: { restaurant: 'Restaurant', bar: 'Bar', massage: 'Massage & Spa', internet: 'Internet', room_service: 'Service en chambre', custom: 'Autre' },
  de: { restaurant: 'Restaurant', bar: 'Bar', massage: 'Massage & Spa', internet: 'Internet', room_service: 'Zimmerservice', custom: 'Sonstiges' },
  es: { restaurant: 'Restaurante', bar: 'Bar', massage: 'Masaje y Spa', internet: 'Internet', room_service: 'Servicio de habitación', custom: 'Otro' },
  it: { restaurant: 'Ristorante', bar: 'Bar', massage: 'Massaggi e Spa', internet: 'Internet', room_service: 'Servizio in camera', custom: 'Altro' },
  pt: { restaurant: 'Restaurante', bar: 'Bar', massage: 'Massagem e Spa', internet: 'Internet', room_service: 'Serviço de quarto', custom: 'Outro' },
  ru: { restaurant: 'Ресторан', bar: 'Бар', massage: 'Массаж и Спа', internet: 'Интернет', room_service: 'Обслуживание номера', custom: 'Другое' },
  zh: { restaurant: '餐厅', bar: '酒吧', massage: '按摩水疗', internet: '网络', room_service: '客房服务', custom: '其他' },
  ja: { restaurant: 'レストラン', bar: 'バー', massage: 'マッサージ＆スパ', internet: 'インターネット', room_service: 'ルームサービス', custom: 'その他' },
  ko: { restaurant: '레스토랑', bar: '바', massage: '마사지 & 스파', internet: '인터넷', room_service: '룸서비스', custom: '기타' },
  tr: { restaurant: 'Restoran', bar: 'Bar', massage: 'Masaj ve Spa', internet: 'İnternet', room_service: 'Oda servisi', custom: 'Diğer' },
  hi: { restaurant: 'रेस्तरां', bar: 'बार', massage: 'मालिश और स्पा', internet: 'इंटरनेट', room_service: 'कमरा सेवा', custom: 'अन्य' },
  nl: { restaurant: 'Restaurant', bar: 'Bar', massage: 'Massage & Spa', internet: 'Internet', room_service: 'Roomservice', custom: 'Overig' },
  th: { restaurant: 'ร้านอาหาร', bar: 'บาร์', massage: 'นวดและสปา', internet: 'อินเทอร์เน็ต', room_service: 'บริการห้องพัก', custom: 'อื่นๆ' },
  el: { restaurant: 'Εστιατόριο', bar: 'Μπαρ', massage: 'Μασάζ & Σπα', internet: 'Ίντερνετ', room_service: 'Υπηρεσία δωματίου', custom: 'Άλλο' },
  pl: { restaurant: 'Restauracja', bar: 'Bar', massage: 'Masaż i Spa', internet: 'Internet', room_service: 'Obsługa pokoju', custom: 'Inne' },
};

export function getTranslatedCategory(value: string, lang: string): string {
  const translations = INVOICE_CATEGORY_TRANSLATIONS[lang] || INVOICE_CATEGORY_TRANSLATIONS['en'];
  return translations[value] || INVOICE_CATEGORIES.find(c => c.value === value)?.label || value;
}

export function getCurrencySymbol(code: string): string {
  return CURRENCIES.find(c => c.code === code)?.symbol || code;
}

export function formatCurrency(amount: number, currencyCode: string): string {
  const symbol = getCurrencySymbol(currencyCode);
  return `${symbol}${amount.toFixed(2)}`;
}
