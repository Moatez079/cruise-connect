import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Plus, Receipt, Trash2, Edit, Eye, EyeOff, Printer, DoorOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CURRENCIES, INVOICE_CATEGORIES, formatCurrency } from '@/lib/currencies';
import type { Tables } from '@/integrations/supabase/types';

type Invoice = Tables<'invoices'>;
type InvoiceItem = Tables<'invoice_items'>;
type Boat = Tables<'boats'>;

const Invoices = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [boats, setBoats] = useState<Boat[]>([]);
  const [selectedBoatId, setSelectedBoatId] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  // New invoice dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newRoomNumber, setNewRoomNumber] = useState('');
  const [newCurrency, setNewCurrency] = useState('USD');
  const [newGuestLang, setNewGuestLang] = useState('en');

  // Add item dialog
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [itemCategory, setItemCategory] = useState('custom');
  const [itemDesc, setItemDesc] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [itemPrice, setItemPrice] = useState('');
  const [editItemId, setEditItemId] = useState<string | null>(null);

  useEffect(() => {
    const fetchBoats = async () => {
      const { data } = await supabase.from('boats').select('*');
      if (data && data.length > 0) {
        setBoats(data);
        setSelectedBoatId(data[0].id);
      }
      setLoading(false);
    };
    fetchBoats();
  }, []);

  useEffect(() => {
    if (!selectedBoatId) return;
    const fetchInvoices = async () => {
      const { data } = await supabase
        .from('invoices')
        .select('*')
        .eq('boat_id', selectedBoatId)
        .order('room_number');
      if (data) setInvoices(data);
    };
    fetchInvoices();
  }, [selectedBoatId]);

  useEffect(() => {
    if (!selectedInvoice) { setItems([]); return; }
    const fetchItems = async () => {
      const { data } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', selectedInvoice.id)
        .order('created_at');
      if (data) setItems(data);
    };
    fetchItems();
  }, [selectedInvoice?.id]);

  const refreshInvoices = async () => {
    const { data } = await supabase.from('invoices').select('*').eq('boat_id', selectedBoatId).order('room_number');
    if (data) setInvoices(data);
  };

  const refreshItems = async () => {
    if (!selectedInvoice) return;
    const { data } = await supabase.from('invoice_items').select('*').eq('invoice_id', selectedInvoice.id).order('created_at');
    if (data) setItems(data);
  };

  const handleCreateInvoice = async () => {
    if (!newRoomNumber || !selectedBoatId || !user) return;
    const { data, error } = await supabase.from('invoices').insert({
      boat_id: selectedBoatId,
      room_number: parseInt(newRoomNumber),
      currency: newCurrency,
      guest_language: newGuestLang,
      created_by: user.id,
    }).select().single();
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Invoice created' });
    setCreateOpen(false);
    setNewRoomNumber('');
    refreshInvoices();
    if (data) setSelectedInvoice(data);
  };

  const handleAddItem = async () => {
    if (!selectedInvoice || !itemDesc || !itemPrice) return;
    if (editItemId) {
      const { error } = await supabase.from('invoice_items').update({
        category: itemCategory as any,
        description: itemDesc,
        quantity: parseInt(itemQty),
        unit_price: parseFloat(itemPrice),
      }).eq('id', editItemId);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Item updated' });
    } else {
      const { error } = await supabase.from('invoice_items').insert({
        invoice_id: selectedInvoice.id,
        category: itemCategory as any,
        description: itemDesc,
        quantity: parseInt(itemQty),
        unit_price: parseFloat(itemPrice),
      });
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Item added' });
    }
    setAddItemOpen(false);
    resetItemForm();
    refreshItems();
  };

  const resetItemForm = () => {
    setItemCategory('custom');
    setItemDesc('');
    setItemQty('1');
    setItemPrice('');
    setEditItemId(null);
  };

  const openEditItem = (item: InvoiceItem) => {
    setEditItemId(item.id);
    setItemCategory(item.category);
    setItemDesc(item.description);
    setItemQty(String(item.quantity));
    setItemPrice(String(item.unit_price));
    setAddItemOpen(true);
  };

  const handleDeleteItem = async (id: string) => {
    await supabase.from('invoice_items').delete().eq('id', id);
    toast({ title: 'Item removed' });
    refreshItems();
  };

  const toggleVisibility = async (invoice: Invoice) => {
    const newStatus = invoice.status === 'visible' ? 'draft' : 'visible';
    await supabase.from('invoices').update({ status: newStatus as any }).eq('id', invoice.id);
    toast({ title: newStatus === 'visible' ? 'Invoice visible to guest' : 'Invoice hidden from guest' });
    refreshInvoices();
    if (selectedInvoice?.id === invoice.id) {
      setSelectedInvoice({ ...invoice, status: newStatus as any });
    }
  };

  const getTotal = () => items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

  const handlePrint = () => {
    if (!selectedInvoice) return;
    window.open(`/invoice-print/${selectedInvoice.id}`, '_blank');
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      draft: 'bg-muted text-muted-foreground',
      visible: 'bg-green-500/20 text-green-400',
      paid: 'bg-primary/20 text-primary',
      closed: 'bg-secondary text-secondary-foreground',
    };
    return map[status] || map.draft;
  };

  return (
    <DashboardLayout title="Invoices" description="Manage guest billing and invoices">
      <div className="space-y-6 animate-fade-in">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <Select value={selectedBoatId} onValueChange={v => { setSelectedBoatId(v); setSelectedInvoice(null); }}>
            <SelectTrigger className="w-[200px] bg-secondary/50">
              <SelectValue placeholder="Select boat" />
            </SelectTrigger>
            <SelectContent>
              {boats.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> New Invoice
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Invoice list */}
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
                    selectedInvoice?.id === inv.id
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border/50 bg-card hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DoorOpen className="w-4 h-4 text-primary" />
                      <span className="font-medium text-sm">Room {inv.room_number}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge(inv.status)}`}>
                        {inv.status}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleVisibility(inv); }}
                        className="text-muted-foreground hover:text-foreground"
                        title={inv.status === 'visible' ? 'Hide from guest' : 'Show to guest'}
                      >
                        {inv.status === 'visible' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{inv.currency}</p>
                </button>
              ))
            )}
          </div>

          {/* Invoice detail */}
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
                    <Button variant="outline" size="sm" onClick={handlePrint}>
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
                                <TableCell className="text-sm">
                                  {cat?.emoji} {cat?.label || item.category}
                                </TableCell>
                                <TableCell className="text-sm">{item.description}</TableCell>
                                <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                                <TableCell className="text-right text-sm">
                                  {formatCurrency(item.unit_price, selectedInvoice.currency)}
                                </TableCell>
                                <TableCell className="text-right text-sm font-medium">
                                  {formatCurrency(item.quantity * item.unit_price, selectedInvoice.currency)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditItem(item)}>
                                      <Edit className="w-3 h-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => handleDeleteItem(item.id)}>
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
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
                          <p className="text-2xl font-serif font-bold text-primary">
                            {formatCurrency(getTotal(), selectedInvoice.currency)}
                          </p>
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
            <DialogHeader>
              <DialogTitle className="font-serif">Create Invoice</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Room Number</Label>
                <Input type="number" min="1" max="100" value={newRoomNumber} onChange={e => setNewRoomNumber(e.target.value)} className="bg-secondary/50" />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={newCurrency} onValueChange={setNewCurrency}>
                  <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => (
                      <SelectItem key={c.code} value={c.code}>{c.symbol} {c.name}</SelectItem>
                    ))}
                  </SelectContent>
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
              <Button onClick={handleCreateInvoice} className="w-full">Create Invoice</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add/Edit Item Dialog */}
        <Dialog open={addItemOpen} onOpenChange={v => { setAddItemOpen(v); if (!v) resetItemForm(); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-serif">{editItemId ? 'Edit Charge' : 'Add Charge'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={itemCategory} onValueChange={setItemCategory}>
                  <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INVOICE_CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.emoji} {c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={itemDesc} onChange={e => setItemDesc(e.target.value)} placeholder="e.g. Dinner for 2" className="bg-secondary/50" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input type="number" min="1" value={itemQty} onChange={e => setItemQty(e.target.value)} className="bg-secondary/50" />
                </div>
                <div className="space-y-2">
                  <Label>Unit Price</Label>
                  <Input type="number" step="0.01" min="0" value={itemPrice} onChange={e => setItemPrice(e.target.value)} className="bg-secondary/50" />
                </div>
              </div>
              <Button onClick={handleAddItem} className="w-full">{editItemId ? 'Save Changes' : 'Add Charge'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Invoices;
