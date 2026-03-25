import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { BoatBrandingProvider } from '@/components/guest/BoatBrandingContext';
import GuestLanguageSelect from '@/components/guest/GuestLanguageSelect';
import GuestMainMenu from '@/components/guest/GuestMainMenu';
import GuestRoomService from '@/components/guest/GuestRoomService';
import GuestCustomRequest from '@/components/guest/GuestCustomRequest';
import GuestDrinksMenu from '@/components/guest/GuestDrinksMenu';
import GuestFeedback from '@/components/guest/GuestFeedback';
import GuestSuccess from '@/components/guest/GuestSuccess';
import GuestInvoice from '@/pages/GuestInvoice';
import PWAInstallPrompt from '@/components/guest/PWAInstallPrompt';

type GuestView = 'language' | 'menu' | 'room_service' | 'drinks' | 'custom' | 'feedback' | 'invoice' | 'success';

const GUEST_SESSION_KEY = 'guest_session';

const saveSession = (boatId: string, roomNumber: number, language: string) => {
  localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify({ boatId, roomNumber, language }));
};

const loadSession = () => {
  try {
    const raw = localStorage.getItem(GUEST_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { boatId: string; roomNumber: number; language: string };
  } catch { return null; }
};

const GuestApp = () => {
  const { boatId, roomNumber } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [language, setLanguage] = useState('');
  const [view, setView] = useState<GuestView>('language');
  const [resolved, setResolved] = useState(false);

  // Read initial view from search params for deep linking
  const initialView = searchParams.get('view') as GuestView | null;

  // If no params (PWA opened to /guest), restore from localStorage
  useEffect(() => {
    if (!boatId || !roomNumber) {
      const session = loadSession();
      if (session) {
        navigate(`/guest/${session.boatId}/${session.roomNumber}`, { replace: true });
        return;
      }
    }
    setResolved(true);
  }, [boatId, roomNumber, navigate]);

  // Auto-restore language from saved session
  useEffect(() => {
    if (resolved && boatId && roomNumber && !language) {
      const session = loadSession();
      if (session && session.boatId === boatId && String(session.roomNumber) === roomNumber) {
        setLanguage(session.language);
        setView(initialView || 'menu');
      }
    }
  }, [resolved, boatId, roomNumber, language, initialView]);

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  if (!resolved) return null;

  if (!boatId || !roomNumber) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <p className="text-muted-foreground">Invalid QR code. Please scan a valid room QR code.</p>
      </div>
    );
  }

  const roomNum = parseInt(roomNumber);

  const handleLanguageSelect = (lang: string) => {
    setLanguage(lang);
    setView('menu');
    saveSession(boatId, roomNum, lang);
  };

  const handleBack = () => {
    if (view === 'menu') setView('language');
    else setView('menu');
  };

  const handleRequestSent = () => {
    setView('success');
  };

  return (
    <BoatBrandingProvider boatId={boatId}>
      <div className="min-h-screen bg-background">
        {view === 'language' && (
          <GuestLanguageSelect onSelect={handleLanguageSelect} />
        )}
        {view === 'menu' && (
          <GuestMainMenu
            language={language}
            roomNumber={roomNum}
            boatId={boatId}
            onNavigate={(v) => setView(v as GuestView)}
            onBack={handleBack}
          />
        )}
        {view === 'room_service' && (
          <GuestRoomService
            language={language}
            boatId={boatId}
            roomNumber={roomNum}
            onBack={handleBack}
            onSuccess={handleRequestSent}
          />
        )}
        {view === 'drinks' && (
          <GuestDrinksMenu
            language={language}
            boatId={boatId}
            roomNumber={roomNum}
            onBack={handleBack}
            onSuccess={handleRequestSent}
          />
        )}
        {view === 'custom' && (
          <GuestCustomRequest
            language={language}
            boatId={boatId}
            roomNumber={roomNum}
            onBack={handleBack}
            onSuccess={handleRequestSent}
          />
        )}
        {view === 'feedback' && (
          <GuestFeedback
            language={language}
            boatId={boatId}
            roomNumber={roomNum}
            onBack={handleBack}
            onSuccess={handleRequestSent}
          />
        )}
        {view === 'invoice' && (
          <GuestInvoice language={language} onBack={() => setView('menu')} />
        )}
        {view === 'success' && (
          <GuestSuccess language={language} onBack={handleBack} />
        )}

        {language && <PWAInstallPrompt language={language} />}
      </div>
    </BoatBrandingProvider>
  );
};

export default GuestApp;
