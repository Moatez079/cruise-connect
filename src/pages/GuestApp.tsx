import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { LANGUAGES, t } from '@/lib/languages';
import { BoatBrandingProvider } from '@/components/guest/BoatBrandingContext';
import GuestLanguageSelect from '@/components/guest/GuestLanguageSelect';
import GuestMainMenu from '@/components/guest/GuestMainMenu';
import GuestRoomService from '@/components/guest/GuestRoomService';
import GuestCustomRequest from '@/components/guest/GuestCustomRequest';
import GuestFeedback from '@/components/guest/GuestFeedback';
import GuestSuccess from '@/components/guest/GuestSuccess';
import GuestInvoice from '@/pages/GuestInvoice';

type GuestView = 'language' | 'menu' | 'room_service' | 'drinks' | 'custom' | 'feedback' | 'invoice' | 'success';

const GuestApp = () => {
  const { boatId, roomNumber } = useParams();
  const [language, setLanguage] = useState('');
  const [view, setView] = useState<GuestView>('language');

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
          <GuestInvoice />
        )}
        {view === 'success' && (
          <GuestSuccess language={language} onBack={handleBack} />
        )}
      </div>
    </BoatBrandingProvider>
  );
};

export default GuestApp;
