import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BoatBranding {
  logoUrl: string | null;
  primaryColor: string;
  boatName: string;
  loading: boolean;
}

const defaultBranding: BoatBranding = {
  logoUrl: null,
  primaryColor: '',
  boatName: '',
  loading: true,
};

const BoatBrandingContext = createContext<BoatBranding>(defaultBranding);

export const useBoatBranding = () => useContext(BoatBrandingContext);

export const BoatBrandingProvider = ({ boatId, children }: { boatId: string; children: ReactNode }) => {
  const [branding, setBranding] = useState<BoatBranding>(defaultBranding);

  useEffect(() => {
    const fetch = async () => {
      const [settingsRes, boatRes] = await Promise.all([
        (supabase.from('boat_settings' as any) as any)
          .select('logo_url, primary_color')
          .eq('boat_id', boatId)
          .maybeSingle(),
        supabase.from('boats').select('name').eq('id', boatId).maybeSingle(),
      ]);

      const s = settingsRes.data as { logo_url?: string; primary_color?: string } | null;
      setBranding({
        logoUrl: s?.logo_url || null,
        primaryColor: s?.primary_color || '',
        boatName: (boatRes.data as any)?.name || '',
        loading: false,
      });
    };
    fetch();
  }, [boatId]);

  return (
    <BoatBrandingContext.Provider value={branding}>
      {/* Inject custom brand color as CSS variable override */}
      {branding.primaryColor && (
        <style>{`
          :root {
            --brand-color: ${branding.primaryColor};
          }
          .brand-accent { color: var(--brand-color); }
          .brand-accent-bg { background-color: var(--brand-color); }
          .brand-accent-bg-light { background-color: color-mix(in srgb, var(--brand-color) 10%, transparent); }
          .brand-accent-border { border-color: color-mix(in srgb, var(--brand-color) 30%, transparent); }
        `}</style>
      )}
      {children}
    </BoatBrandingContext.Provider>
  );
};
