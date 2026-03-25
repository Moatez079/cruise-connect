import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const INSTALL_TRANSLATIONS: Record<string, { title: string; desc: string; install: string }> = {
  en: { title: 'Install App', desc: 'Add to home screen for quick access', install: 'Install' },
  ar: { title: 'تثبيت التطبيق', desc: 'أضف للشاشة الرئيسية للوصول السريع', install: 'تثبيت' },
  fr: { title: 'Installer l\'app', desc: 'Ajouter à l\'écran d\'accueil', install: 'Installer' },
  de: { title: 'App installieren', desc: 'Zum Startbildschirm hinzufügen', install: 'Installieren' },
  es: { title: 'Instalar app', desc: 'Añadir a la pantalla de inicio', install: 'Instalar' },
  it: { title: 'Installa app', desc: 'Aggiungi alla schermata Home', install: 'Installa' },
  pt: { title: 'Instalar app', desc: 'Adicionar à tela inicial', install: 'Instalar' },
  ru: { title: 'Установить', desc: 'Добавить на главный экран', install: 'Установить' },
  zh: { title: '安装应用', desc: '添加到主屏幕以快速访问', install: '安装' },
  ja: { title: 'アプリをインストール', desc: 'ホーム画面に追加', install: 'インストール' },
  ko: { title: '앱 설치', desc: '홈 화면에 추가', install: '설치' },
  tr: { title: 'Uygulamayı yükle', desc: 'Ana ekrana ekle', install: 'Yükle' },
};

interface Props {
  language: string;
}

const PWAInstallPrompt = ({ language }: Props) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  const texts = INSTALL_TRANSLATIONS[language] || INSTALL_TRANSLATIONS.en;

  const handleInstall = async () => {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto animate-fade-in">
      <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border shadow-lg">
        <div className="p-2.5 rounded-lg bg-primary/10">
          <Download className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{texts.title}</p>
          <p className="text-xs text-muted-foreground">{texts.desc}</p>
        </div>
        <Button size="sm" onClick={handleInstall} className="shrink-0">
          {texts.install}
        </Button>
        <button onClick={() => setDismissed(true)} className="text-muted-foreground p-1">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
