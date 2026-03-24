import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Plus, UserPlus, Shield, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

type Boat = Tables<'boats'>;

interface UserWithRole {
  id: string;
  email: string;
  display_name: string | null;
  role: string | null;
  assignments: string[];
}

const UsersPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [boats, setBoats] = useState<Boat[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [newRole, setNewRole] = useState<string>('receptionist');
  const [selectedBoatId, setSelectedBoatId] = useState('');

  const fetchData = async () => {
    const [profilesRes, rolesRes, assignmentsRes, boatsRes] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('user_roles').select('*'),
      supabase.from('user_boat_assignments').select('*'),
      supabase.from('boats').select('*'),
    ]);

    if (profilesRes.data && rolesRes.data && assignmentsRes.data) {
      const mapped: UserWithRole[] = profilesRes.data.map(p => ({
        id: p.id,
        email: '',
        display_name: p.display_name,
        role: rolesRes.data?.find(r => r.user_id === p.id)?.role || null,
        assignments: assignmentsRes.data?.filter(a => a.user_id === p.id).map(a => a.boat_id) || [],
      }));
      setUsers(mapped);
    }

    if (boatsRes.data) setBoats(boatsRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleAssignRole = async () => {
    if (!selectedUserId || !newRole) return;

    // Remove existing roles first
    await supabase.from('user_roles').delete().eq('user_id', selectedUserId);
    
    const { error } = await supabase.from('user_roles').insert({
      user_id: selectedUserId,
      role: newRole as any,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Role assigned!' });
    setDialogOpen(false);
    fetchData();
  };

  const handleAssignBoat = async () => {
    if (!selectedUserId || !selectedBoatId) return;

    const { error } = await supabase.from('user_boat_assignments').insert({
      user_id: selectedUserId,
      boat_id: selectedBoatId,
    });

    if (error) {
      if (error.code === '23505') {
        toast({ title: 'Already assigned', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
      return;
    }
    toast({ title: 'User assigned to boat!' });
    setAssignDialogOpen(false);
    fetchData();
  };

  const handleRemoveAssignment = async (userId: string, boatId: string) => {
    await supabase.from('user_boat_assignments').delete().match({ user_id: userId, boat_id: boatId });
    toast({ title: 'Assignment removed' });
    fetchData();
  };

  const getRoleBadgeColor = (role: string | null) => {
    switch (role) {
      case 'owner': return 'bg-primary/20 text-primary';
      case 'boat_admin': return 'bg-blue-500/20 text-blue-400';
      case 'receptionist': return 'bg-green-500/20 text-green-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <DashboardLayout title="Users" description="Manage team members and permissions">
      <div className="space-y-6 animate-fade-in">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <Card className="border-dashed border-2 border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <UserPlus className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No users found. Users will appear here after signing up.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {users.map(u => (
              <Card key={u.id} className="border-border/50">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                      <span className="text-sm font-medium">
                        {(u.display_name || '?')[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{u.display_name || 'Unknown'}</p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getRoleBadgeColor(u.role)}`}>
                          {u.role || 'No role'}
                        </span>
                        {u.assignments.map(aId => {
                          const boat = boats.find(b => b.id === aId);
                          return boat ? (
                            <span key={aId} className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground flex items-center gap-1">
                              {boat.name}
                              <button onClick={() => handleRemoveAssignment(u.id, aId)} className="hover:text-destructive">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {u.id !== user?.id && (
                      <>
                        <Dialog open={dialogOpen && selectedUserId === u.id} onOpenChange={(open) => { setDialogOpen(open); if (open) setSelectedUserId(u.id); }}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Shield className="w-3 h-3 mr-1" /> Role
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle className="font-serif">Assign Role</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 mt-4">
                              <Select value={newRole} onValueChange={setNewRole}>
                                <SelectTrigger className="bg-secondary/50">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="boat_admin">Boat Admin</SelectItem>
                                  <SelectItem value="receptionist">Receptionist</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button onClick={handleAssignRole} className="w-full">Assign Role</Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Dialog open={assignDialogOpen && selectedUserId === u.id} onOpenChange={(open) => { setAssignDialogOpen(open); if (open) setSelectedUserId(u.id); }}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Plus className="w-3 h-3 mr-1" /> Boat
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle className="font-serif">Assign to Boat</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 mt-4">
                              <Select value={selectedBoatId} onValueChange={setSelectedBoatId}>
                                <SelectTrigger className="bg-secondary/50">
                                  <SelectValue placeholder="Select a boat" />
                                </SelectTrigger>
                                <SelectContent>
                                  {boats.map(b => (
                                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button onClick={handleAssignBoat} className="w-full">Assign to Boat</Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default UsersPage;
