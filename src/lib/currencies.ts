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

export function getCurrencySymbol(code: string): string {
  return CURRENCIES.find(c => c.code === code)?.symbol || code;
}

export function formatCurrency(amount: number, currencyCode: string): string {
  const symbol = getCurrencySymbol(currencyCode);
  return `${symbol}${amount.toFixed(2)}`;
}
