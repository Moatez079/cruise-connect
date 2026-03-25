import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Plus, Receipt, Trash2, Edit, Eye, EyeOff, Printer, DoorOpen, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useBoats } from '@/hooks/useBoats';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { CURRENCIES, INVOICE_CATEGORIES, formatCurrency } from '@/lib/currencies';
import type { Tables } from '@/integrations/supabase/types';

type Invoice = Tables<'invoices'>;
type InvoiceItem = Tables<'invoice_items'>;

const Invoices = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: boats = [] } = useBoats();
  const [selectedBoatId, setSelectedBoatId] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newRoomNumber, setNewRoomNumber] = useState('');
  const [newCurrency, setNewCurrency] = useState('USD');
  const [newGuestLang, setNewGuestLang] = useState('en');

  const [addItemOpen, setAddItemOpen] = useState(false);
  const [itemCategory, setItemCategory] = useState('custom');
  const [itemDesc, setItemDesc] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [itemPrice, setItemPrice] = useState('');
  const [editItemId, setEditItemId] = useState<string | null>(null);

  const effectiveBoatId = selectedBoatId || boats[0]?.id || '';

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices', effectiveBoatId],
    queryFn: async () => {
      if (!effectiveBoatId) return [];
      const { data, error } = await supabase.from('invoices').select('*').eq('boat_id', effectiveBoatId).order('room_number');
      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!effectiveBoatId,
  });

  const { data: items = [] } = useQuery({
    queryKey: ['invoice-items', selectedInvoice?.id],
    queryFn: async () => {
      if (!selectedInvoice) return [];
      const { data, error } = await supabase.from('invoice_items').select('*').eq('invoice_id', selectedInvoice.id).order('created_at');
      if (error) throw error;
      return data as InvoiceItem[];
    },
    enabled: !!selectedInvoice?.id,
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!newRoomNumber || !effectiveBoatId || !user) throw new Error('Missing data');
      const { data, error } = await supabase.from('invoices').insert({
        boat_id: effectiveBoatId, room_number: parseInt(newRoomNumber),
        currency: newCurrency, guest_language: newGuestLang, created_by: user.id,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: 'Invoice created' });
      setCreateOpen(false);
      setNewRoomNumber('');
      queryClient.invalidateQueries({ queryKey: ['invoices', effectiveBoatId] });
      if (data) setSelectedInvoice(data);
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const addItemMutation = useMutation({
    mutationFn: async () => {
      if (!selectedInvoice || !itemDesc || !itemPrice) throw new Error('Missing');
      if (editItemId) {
        const { error } = await supabase.from('invoice_items').update({
          category: itemCategory as any, description: itemDesc,
          quantity: parseInt(itemQty), unit_price: parseFloat(itemPrice),
        }).eq('id', editItemId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('invoice_items').insert({
          invoice_id: selectedInvoice.id, category: itemCategory as any,
          description: itemDesc, quantity: parseInt(itemQty), unit_price: parseFloat(itemPrice),
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editItemId ? 'Item updated' : 'Item added' });
      setAddItemOpen(false);
      resetItemForm();
      queryClient.invalidateQueries({ queryKey: ['invoice-items', selectedInvoice?.id] });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const resetItemForm = () => { setItemCategory('custom'); setItemDesc(''); setItemQty('1'); setItemPrice(''); setEditItemId(null); };

  const openEditItem = (item: InvoiceItem) => {
    setEditItemId(item.id); setItemCategory(item.category); setItemDesc(item.description);
    setItemQty(String(item.quantity)); setItemPrice(String(item.unit_price)); setAddItemOpen(true);
  };

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('invoice_items').delete().eq('id', id);
    },
    onSuccess: () => {
      toast({ title: 'Item removed' });
      queryClient.invalidateQueries({ queryKey: ['invoice-items', selectedInvoice?.id] });
    },
  });

  const toggleVisibility = async (invoice: Invoice) => {
    const newStatus = invoice.status === 'visible' ? 'draft' : 'visible';
    await supabase.from('invoices').update({ status: newStatus as any }).eq('id', invoice.id);
    toast({ title: newStatus === 'visible' ? 'Invoice visible to guest' : 'Invoice hidden from guest' });
    queryClient.invalidateQueries({ queryKey: ['invoices', effectiveBoatId] });
    if (selectedInvoice?.id === invoice.id) setSelectedInvoice({ ...invoice, status: newStatus as any });
  };

  const getTotal = () => items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      draft: 'bg-muted text-muted-foreground', visible: 'bg-green-500/20 text-green-400',
      paid: 'bg-primary/20 text-primary', closed: 'bg-secondary text-secondary-foreground',
    };
    return map[status] || map.draft;
  };

  return (
    <DashboardLayout title="Invoices" description="Manage guest billing and invoices">
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <Select value={effectiveBoatId} onValueChange={v => { setSelectedBoatId(v); setSelectedInvoice(null); }}>
            <SelectTrigger className="w-[200px] bg-secondary/50"><SelectValue placeholder="Select boat" /></SelectTrigger>
            <SelectContent>
              {boats.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-2" /> New Invoice</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Room Invoices</h3>
            {invoices.length === 0 ? (
              <Card className="border-dashed border-2 border-border/50">
                <CardContent className="py-8 text-center">
                  <Receipt className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No invoices yet</p>
                </CardContent>
              </Card>
            ) : (
              invoices.map(inv => (
                <button
                  key={inv.id}
                  onClick={() => setSelectedInvoice(inv)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedInvoice?.id === inv.id ? 'border-primary/50 bg-primary/5' : 'border-border/50 bg-card hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DoorOpen className="w-4 h-4 text-primary" />
                      <span className="font-medium text-sm">Room {inv.room_number}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge(inv.status)}`}>{inv.status}</span>
                      <button onClick={(e) => { e.stopPropagation(); toggleVisibility(inv); }} className="text-muted-foreground hover:text-foreground">
                        {inv.status === 'visible' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{inv.currency}</p>
                </button>
              ))
            )}
          </div>

          <div className="lg:col-span-2">
            {!selectedInvoice ? (
              <Card className="border-dashed border-2 border-border/50 h-full">
                <CardContent className="flex items-center justify-center h-full min-h-[300px]">
                  <p className="text-muted-foreground">Select an invoice to view details</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border/50">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="font-serif text-lg">Room {selectedInvoice.room_number} Invoice</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">Currency: {selectedInvoice.currency}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => window.open(`/invoice-print/${selectedInvoice.id}`, '_blank')}>
                      <Printer className="w-4 h-4 mr-1" /> Print
                    </Button>
                    <Button size="sm" onClick={() => { resetItemForm(); setAddItemOpen(true); }}>
                      <Plus className="w-4 h-4 mr-1" /> Add Item
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {items.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8 text-sm">No charges yet. Add items to this invoice.</p>
                  ) : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Price</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="w-[80px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map(item => {
                            const cat = INVOICE_CATEGORIES.find(c => c.value === item.category);
                            return (
                              <TableRow key={item.id}>
                                <TableCell className="text-sm">{cat?.emoji} {cat?.label || item.category}</TableCell>
                                <TableCell className="text-sm">{item.description}</TableCell>
                                <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                                <TableCell className="text-right text-sm">{formatCurrency(item.unit_price, selectedInvoice.currency)}</TableCell>
                                <TableCell className="text-right text-sm font-medium">{formatCurrency(item.quantity * item.unit_price, selectedInvoice.currency)}</TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditItem(item)}><Edit className="w-3 h-3" /></Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => deleteItemMutation.mutate(item.id)}><Trash2 className="w-3 h-3" /></Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      <div className="flex justify-end mt-4 pt-4 border-t border-border/50">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Total</p>
                          <p className="text-2xl font-serif font-bold text-primary">{formatCurrency(getTotal(), selectedInvoice.currency)}</p>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Create Invoice Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-serif">Create Invoice</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Room Number</Label>
                <Input type="number" min="1" value={newRoomNumber} onChange={e => setNewRoomNumber(e.target.value)} className="bg-secondary/50" />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={newCurrency} onValueChange={setNewCurrency}>
                  <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{c.symbol} {c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Guest Language</Label>
                <Select value={newGuestLang} onValueChange={setNewGuestLang}>
                  <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ar">Arabic</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="it">Italian</SelectItem>
                    <SelectItem value="ru">Russian</SelectItem>
                    <SelectItem value="zh">Chinese</SelectItem>
                    <SelectItem value="ja">Japanese</SelectItem>
                    <SelectItem value="tr">Turkish</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => createInvoiceMutation.mutate()} className="w-full" disabled={createInvoiceMutation.isPending}>
                {createInvoiceMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Create Invoice
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add/Edit Item Dialog */}
        <Dialog open={addItemOpen} onOpenChange={v => { setAddItemOpen(v); if (!v) resetItemForm(); }}>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-serif">{editItemId ? 'Edit Charge' : 'Add Charge'}</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={itemCategory} onValueChange={setItemCategory}>
                  <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                  <SelectContent>{INVOICE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.emoji} {c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={itemDesc} onChange={e => setItemDesc(e.target.value)} className="bg-secondary/50" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input type="number" min="1" value={itemQty} onChange={e => setItemQty(e.target.value)} className="bg-secondary/50" />
                </div>
                <div className="space-y-2">
                  <Label>Unit Price</Label>
                  <Input type="number" step="0.01" value={itemPrice} onChange={e => setItemPrice(e.target.value)} className="bg-secondary/50" />
                </div>
              </div>
              <Button onClick={() => addItemMutation.mutate()} className="w-full" disabled={addItemMutation.isPending}>
                {addItemMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {editItemId ? 'Save Changes' : 'Add Charge'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Invoices;
