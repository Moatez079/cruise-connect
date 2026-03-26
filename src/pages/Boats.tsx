import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import { Plus, Ship, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

type Boat = Tables<'boats'>;

const Boats = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [boats, setBoats] = useState<Boat[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBoat, setEditBoat] = useState<Boat | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const fetchBoats = async () => {
    const { data } = await supabase.from('boats').select('*').order('created_at', { ascending: false });
    if (data) setBoats(data);
    setLoading(false);
  };

  useEffect(() => { fetchBoats(); }, []);

  const handleSave = async () => {
    if (!name.trim() || !user) return;

    if (editBoat) {
      const { error } = await supabase.from('boats').update({ name, description }).eq('id', editBoat.id);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Boat updated' });
    } else {
      const { error } = await supabase.from('boats').insert({ name, description, owner_id: user.id });
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Boat created!' });
    }

    setDialogOpen(false);
    setEditBoat(null);
    setName('');
    setDescription('');
    fetchBoats();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('boats').delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Boat deleted' });
    fetchBoats();
  };

  const openEdit = (boat: Boat) => {
    setEditBoat(boat);
    setName(boat.name);
    setDescription(boat.description || '');
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditBoat(null);
    setName('');
    setDescription('');
    setDialogOpen(true);
  };

  return (
    <DashboardLayout title="Boats" description="Manage your fleet">
      <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground">{boats.length} boat{boats.length !== 1 ? 's' : ''}</p>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) { setEditBoat(null); setName(''); setDescription(''); }
          }}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" /> Add Boat
              </Button>
            </DialogTrigger>
            <DialogContent onPointerDownOutside={(e) => e.preventDefault()}>
              <DialogHeader>
                <DialogTitle className="font-serif">{editBoat ? 'Edit Boat' : 'Add New Boat'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="boat-name">Boat Name</Label>
                  <Input
                    id="boat-name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="MS Ocean Star"
                    className="bg-secondary/50"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="boat-desc">Description</Label>
                  <Textarea
                    id="boat-desc"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Luxury cruise ship..."
                    className="bg-secondary/50"
                  />
                </div>
                <Button onClick={handleSave} className="w-full" disabled={!name.trim()}>
                  {editBoat ? 'Save Changes' : 'Create Boat'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : boats.length === 0 ? (
          <Card className="border-dashed border-2 border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Ship className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">No boats yet. Add your first boat to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {boats.map(boat => (
              <Card key={boat.id} className="border-border/50 hover:border-primary/30 transition-colors">
                <CardHeader className="flex flex-row items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Ship className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="font-serif text-lg">{boat.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">Max {boat.max_rooms} rooms</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(boat)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(boat.id)} className="hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                {boat.description && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{boat.description}</p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Boats;
