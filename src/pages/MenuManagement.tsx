import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Upload, Plus, Trash2, ImageIcon, Ship, Sparkles, Pencil } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Boat {
  id: string;
  name: string;
}

interface MenuItem {
  id: string;
  boat_id: string;
  name: string;
  name_ar: string | null;
  price: number;
  category: string;
  available: boolean;
  sort_order: number;
}

const CATEGORIES = [
  { value: 'hot_drinks', label: '☕ Hot Drinks' },
  { value: 'cold_drinks', label: '🧊 Cold Drinks' },
  { value: 'juices', label: '🧃 Juices' },
  { value: 'cocktails', label: '🍹 Cocktails' },
  { value: 'beer', label: '🍺 Beer' },
  { value: 'wine', label: '🍷 Wine' },
  { value: 'spirits', label: '🥃 Spirits' },
  { value: 'soft_drinks', label: '🥤 Soft Drinks' },
  { value: 'other', label: '🍽️ Other' },
];

const MenuManagement = () => {
  const [boats, setBoats] = useState<Boat[]>([]);
  const [selectedBoat, setSelectedBoat] = useState('');
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Form state
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCategory, setFormCategory] = useState('other');

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

  const fetchItems = async () => {
    if (!selectedBoat) return;
    setLoading(true);
    const { data } = await (supabase.from('menu_items' as any) as any)
      .select('*')
      .eq('boat_id', selectedBoat)
      .order('sort_order', { ascending: true });
    setItems((data as MenuItem[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, [selectedBoat]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please upload an image.', variant: 'destructive' });
      return;
    }

    setExtracting(true);
    try {
      // Upload image
      const ext = file.name.split('.').pop();
      const fileName = `menu_${selectedBoat}_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('menu-images')
        .upload(fileName, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('menu-images').getPublicUrl(fileName);
      const imageUrl = urlData.publicUrl;

      // Call AI extraction
      const { data, error } = await supabase.functions.invoke('extract-menu', {
        body: { imageUrl },
      });

      if (error) throw error;

      const extractedItems = data?.items || [];
      if (extractedItems.length === 0) {
        toast({ title: 'No items found', description: 'Could not extract menu items from the image. Try a clearer photo.', variant: 'destructive' });
        return;
      }

      // Insert extracted items
      const toInsert = extractedItems.map((item: any, idx: number) => ({
        boat_id: selectedBoat,
        name: item.name_en || item.name,
        name_ar: item.name !== item.name_en ? item.name : null,
        price: item.price || 0,
        category: item.category || 'other',
        sort_order: (items.length + idx),
        available: true,
      }));

      const { error: insertErr } = await (supabase.from('menu_items' as any) as any).insert(toInsert);
      if (insertErr) throw insertErr;

      toast({ title: `${extractedItems.length} items extracted!`, description: 'Menu items have been added. Review and adjust prices as needed.' });
      fetchItems();
    } catch (err: any) {
      toast({ title: 'Extraction failed', description: err.message, variant: 'destructive' });
    } finally {
      setExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddItem = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      if (editItem) {
        const { error } = await (supabase.from('menu_items' as any) as any)
          .update({ name: formName, price: parseFloat(formPrice) || 0, category: formCategory })
          .eq('id', editItem.id);
        if (error) throw error;
        toast({ title: 'Item updated' });
      } else {
        const { error } = await (supabase.from('menu_items' as any) as any).insert({
          boat_id: selectedBoat,
          name: formName,
          price: parseFloat(formPrice) || 0,
          category: formCategory,
          sort_order: items.length,
        });
        if (error) throw error;
        toast({ title: 'Item added' });
      }
      setShowAdd(false);
      setEditItem(null);
      resetForm();
      fetchItems();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAvailable = async (item: MenuItem) => {
    await (supabase.from('menu_items' as any) as any)
      .update({ available: !item.available })
      .eq('id', item.id);
    fetchItems();
  };

  const handleDelete = async (id: string) => {
    await (supabase.from('menu_items' as any) as any).delete().eq('id', id);
    fetchItems();
  };

  const openEdit = (item: MenuItem) => {
    setEditItem(item);
    setFormName(item.name);
    setFormPrice(String(item.price));
    setFormCategory(item.category);
    setShowAdd(true);
  };

  const resetForm = () => {
    setFormName('');
    setFormPrice('');
    setFormCategory('other');
    setEditItem(null);
  };

  const getCategoryLabel = (val: string) => CATEGORIES.find(c => c.value === val)?.label || val;

  return (
    <DashboardLayout title="Drinks Menu" description="Manage drink menus for your boats">
      <div className="space-y-6">
        {/* Boat Selector */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label>Select Boat</Label>
            <Select value={selectedBoat} onValueChange={setSelectedBoat}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select a boat" />
              </SelectTrigger>
              <SelectContent>
                {boats.map(b => (
                  <SelectItem key={b.id} value={b.id}>
                    <div className="flex items-center gap-2"><Ship className="w-4 h-4" />{b.name}</div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={extracting || !selectedBoat}
            >
              {extracting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Extracting with AI...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" />Upload Menu Image</>
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
            <Button onClick={() => { resetForm(); setShowAdd(true); }} disabled={!selectedBoat}>
              <Plus className="w-4 h-4 mr-2" />Add Item
            </Button>
          </div>
        </div>

        {/* Items Table */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <Card className="border-dashed border-2 border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <ImageIcon className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No menu items yet</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                Upload a photo of your drinks menu and AI will extract the items automatically, or add items manually.
              </p>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={extracting}
              >
                <Sparkles className="w-4 h-4 mr-2" />Upload Menu Image
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Menu Items ({items.length})</CardTitle>
              <CardDescription>Manage your drinks and beverages</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{item.name}</span>
                          {item.name_ar && <span className="text-xs text-muted-foreground block">{item.name_ar}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{getCategoryLabel(item.category)}</TableCell>
                      <TableCell className="font-mono">{item.price > 0 ? `$${item.price}` : '—'}</TableCell>
                      <TableCell>
                        <Switch
                          checked={item.available}
                          onCheckedChange={() => handleToggleAvailable(item)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="text-destructive hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showAdd} onOpenChange={(o) => { setShowAdd(o); if (!o) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editItem ? 'Edit Item' : 'Add Menu Item'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Turkish Coffee" />
            </div>
            <div className="space-y-2">
              <Label>Price</Label>
              <Input type="number" step="0.01" value={formPrice} onChange={e => setFormPrice(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddItem} disabled={saving || !formName.trim()}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editItem ? 'Save Changes' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default MenuManagement;
