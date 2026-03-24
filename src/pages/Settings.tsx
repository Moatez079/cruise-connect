import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { CURRENCIES } from '@/lib/currencies';
import { Loader2, Save, Upload, Palette, Ship } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Boat {
  id: string;
  name: string;
}

interface BoatSettings {
  id: string;
  boat_id: string;
  farewell_message: string;
  default_currency: string;
  logo_url: string | null;
  primary_color: string;
}

const Settings = () => {
  const [boats, setBoats] = useState<Boat[]>([]);
  const [selectedBoat, setSelectedBoat] = useState<string>('');
  const [settings, setSettings] = useState<BoatSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Form state
  const [farewellMessage, setFarewellMessage] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  const [primaryColor, setPrimaryColor] = useState('#1a365d');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Load boats
  useEffect(() => {
    const fetchBoats = async () => {
      const { data } = await supabase.from('boats').select('id, name');
      if (data && data.length > 0) {
        setBoats(data);
        setSelectedBoat(data[0].id);
      }
      setLoading(false);
    };
    fetchBoats();
  }, []);

  // Load settings when boat changes
  useEffect(() => {
    if (!selectedBoat) return;
    const fetchSettings = async () => {
      setLoading(true);
      const { data } = await (supabase.from('boat_settings' as any) as any)
        .select('*')
        .eq('boat_id', selectedBoat)
        .maybeSingle();

      if (data) {
        setSettings(data as BoatSettings);
        setFarewellMessage(data.farewell_message);
        setDefaultCurrency(data.default_currency);
        setPrimaryColor(data.primary_color || '#1a365d');
        setLogoUrl(data.logo_url);
      } else {
        // No settings yet, use defaults
        setSettings(null);
        setFarewellMessage('Thank you for sailing with us! We hope you had a wonderful experience and look forward to welcoming you aboard again.');
        setDefaultCurrency('USD');
        setPrimaryColor('#1a365d');
        setLogoUrl(null);
      }
      setLoading(false);
    };
    fetchSettings();
  }, [selectedBoat]);

  const handleSave = async () => {
    if (!selectedBoat) return;
    setSaving(true);

    try {
      const payload = {
        boat_id: selectedBoat,
        farewell_message: farewellMessage,
        default_currency: defaultCurrency,
        primary_color: primaryColor,
        logo_url: logoUrl,
      };

      if (settings) {
        const { error } = await (supabase.from('boat_settings' as any) as any)
          .update(payload)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from('boat_settings' as any) as any)
          .insert(payload);
        if (error) throw error;
      }

      toast({ title: 'Settings saved', description: 'Your boat settings have been updated.' });

      // Refresh settings
      const { data } = await (supabase.from('boat_settings' as any) as any)
        .select('*')
        .eq('boat_id', selectedBoat)
        .maybeSingle();
      if (data) setSettings(data as BoatSettings);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please upload an image file.', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${selectedBoat}_logo_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('boat-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('boat-logos').getPublicUrl(fileName);
      setLogoUrl(urlData.publicUrl);
      toast({ title: 'Logo uploaded', description: 'Don\'t forget to save your settings.' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const boatName = boats.find((b) => b.id === selectedBoat)?.name || '';

  return (
    <DashboardLayout title="Settings" description="Customize your boat branding and preferences">
      <div className="space-y-6 max-w-2xl">
        {/* Boat Selector */}
        <div className="space-y-2">
          <Label>Select Boat</Label>
          <Select value={selectedBoat} onValueChange={setSelectedBoat}>
            <SelectTrigger className="w-full sm:w-[300px]">
              <SelectValue placeholder="Select a boat" />
            </SelectTrigger>
            <SelectContent>
              {boats.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  <div className="flex items-center gap-2">
                    <Ship className="w-4 h-4" />
                    {b.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full" />)}
          </div>
        ) : (
          <>
            {/* Logo & Branding */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base">Boat Branding</CardTitle>
                <CardDescription>Upload a logo and set brand colors for {boatName}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Logo</Label>
                  <div className="flex items-center gap-4">
                    {logoUrl ? (
                      <div className="w-20 h-20 rounded-lg border border-border overflow-hidden bg-muted flex items-center justify-center">
                        <img src={logoUrl} alt="Boat logo" className="w-full h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-lg border border-dashed border-border flex items-center justify-center bg-muted/50">
                        <Ship className="w-8 h-8 text-muted-foreground/30" />
                      </div>
                    )}
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                      >
                        {uploading ? (
                          <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Uploading...</>
                        ) : (
                          <><Upload className="w-3 h-3 mr-1" /> Upload Logo</>
                        )}
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                      <p className="text-xs text-muted-foreground mt-1">PNG or JPG, max 2MB</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Brand Color</Label>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-10 h-10 rounded-lg border border-border cursor-pointer"
                      />
                    </div>
                    <Input
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      placeholder="#1a365d"
                      className="w-32 font-mono text-sm"
                    />
                    <div
                      className="w-10 h-10 rounded-lg border border-border"
                      style={{ backgroundColor: primaryColor }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Farewell Message */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base">Farewell Message</CardTitle>
                <CardDescription>
                  This message appears on guest invoices. It will be auto-translated to the guest's language.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={farewellMessage}
                  onChange={(e) => setFarewellMessage(e.target.value)}
                  placeholder="Write your farewell message..."
                  className="min-h-[120px] resize-none"
                />
              </CardContent>
            </Card>

            {/* Default Currency */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base">Default Currency</CardTitle>
                <CardDescription>
                  New invoices for {boatName} will use this currency by default.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
                  <SelectTrigger className="w-full sm:w-[300px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.symbol} {c.code} — {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Save Button */}
            <Button onClick={handleSave} disabled={saving} size="lg" className="w-full sm:w-auto">
              {saving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" /> Save Settings</>
              )}
            </Button>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Settings;
