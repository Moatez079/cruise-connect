import { t } from '@/lib/languages';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';

interface Props {
  language: string;
  onBack: () => void;
}

const GuestSuccess = ({ language, onBack }: Props) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md text-center animate-fade-in">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
          <CheckCircle2 className="w-10 h-10 text-primary" />
        </div>

        <h1 className="text-2xl font-serif font-bold mb-2">{t(language, 'requestSent')}</h1>
        <p className="text-muted-foreground mb-8">{t(language, 'requestSentDesc')}</p>

        <Button onClick={onBack} variant="outline" size="lg">
          {t(language, 'back')}
        </Button>
      </div>
    </div>
  );
};

export default GuestSuccess;
