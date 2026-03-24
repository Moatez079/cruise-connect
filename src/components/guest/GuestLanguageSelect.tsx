import { LANGUAGES } from '@/lib/languages';
import { Anchor } from 'lucide-react';

interface Props {
  onSelect: (lang: string) => void;
}

const GuestLanguageSelect = ({ onSelect }: Props) => {
  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Anchor className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-foreground">Welcome Aboard</h1>
          <p className="text-muted-foreground mt-2 text-sm">Please select your language</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => onSelect(lang.code)}
              className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-card hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
            >
              <span className="text-2xl">{lang.flag}</span>
              <div>
                <p className="text-sm font-medium text-foreground">{lang.nativeName}</p>
                <p className="text-xs text-muted-foreground">{lang.name}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GuestLanguageSelect;
