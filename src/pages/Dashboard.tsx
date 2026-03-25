import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Ship, DoorOpen, Anchor } from 'lucide-react';
import { DashboardSkeleton } from '@/components/ui/page-skeleton';

const Dashboard = () => {
  const { isOwner } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [boatsRes, roomsRes] = await Promise.all([
        supabase.from('boats').select('id', { count: 'exact', head: true }),
        supabase.from('rooms').select('id', { count: 'exact', head: true }),
      ]);
      return {
        boats: boatsRes.count || 0,
        rooms: roomsRes.count || 0,
      };
    },
  });

  const statCards = [
    { title: 'Total Boats', value: stats?.boats ?? 0, icon: Ship, color: 'text-primary' },
    { title: 'Total Rooms', value: stats?.rooms ?? 0, icon: DoorOpen, color: 'text-primary' },
  ];

  return (
    <DashboardLayout title="Dashboard" description="Overview of your floating hotel fleet">
      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-6 animate-fade-in">
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 rounded-full bg-primary/10">
                <Anchor className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-serif font-semibold">Welcome aboard!</h2>
                <p className="text-muted-foreground text-sm">
                  {isOwner
                    ? 'Manage your fleet, crew, and guest services from here.'
                    : 'Manage rooms and guest services for your assigned boat.'}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {statCards.map((stat) => (
              <Card key={stat.title} className="border-border/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-serif font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default Dashboard;
