import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Star, MessageSquare, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface FeedbackRow {
  id: string;
  boat_id: string;
  room_number: number;
  guest_language: string;
  overall_rating: number;
  service_rating: number | null;
  cleanliness_rating: number | null;
  food_rating: number | null;
  original_comment: string | null;
  translated_comment: string | null;
  pdf_path: string | null;
  created_at: string;
}

interface Boat {
  id: string;
  name: string;
}

const StarDisplay = ({ rating }: { rating: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((s) => (
      <Star
        key={s}
        className={`w-4 h-4 ${s <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/20'}`}
      />
    ))}
  </div>
);

const Feedback = () => {
  const [feedbacks, setFeedbacks] = useState<FeedbackRow[]>([]);
  const [boats, setBoats] = useState<Boat[]>([]);
  const [selectedBoat, setSelectedBoat] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: boatsData } = await supabase.from('boats').select('id, name');
      if (boatsData) setBoats(boatsData);

      let query = (supabase.from('guest_feedback' as any) as any).select('*').order('created_at', { ascending: false });
      if (selectedBoat !== 'all') query = query.eq('boat_id', selectedBoat);

      const { data } = await query;
      if (data) setFeedbacks(data as FeedbackRow[]);
      setLoading(false);
    };
    fetchData();
  }, [selectedBoat]);

  const getBoatName = (id: string) => boats.find((b) => b.id === id)?.name || 'Unknown';

  const avgRating = feedbacks.length
    ? (feedbacks.reduce((sum, f) => sum + f.overall_rating, 0) / feedbacks.length).toFixed(1)
    : '—';

  const downloadPdf = async (path: string) => {
    const { data } = supabase.storage.from('feedback-pdfs').getPublicUrl(path);
    window.open(data.publicUrl, '_blank');
  };

  return (
    <DashboardLayout title="Guest Feedback" description="View feedback submitted by guests">
      <div className="space-y-6">
        {/* Filters & Stats */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-4">
            <Select value={selectedBoat} onValueChange={setSelectedBoat}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Boats" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Boats</SelectItem>
                {boats.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
            <span className="font-semibold text-lg">{avgRating}</span>
            <span className="text-muted-foreground">avg · {feedbacks.length} reviews</span>
          </div>
        </div>

        {/* Feedback List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
          </div>
        ) : feedbacks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MessageSquare className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">No feedback yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {feedbacks.map((fb) => (
              <Card key={fb.id} className="border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      Room {fb.room_number} · {getBoatName(fb.boat_id)}
                    </CardTitle>
                    <span className="text-xs text-muted-foreground">
                      {new Date(fb.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Overall</p>
                      <StarDisplay rating={fb.overall_rating} />
                    </div>
                    {fb.service_rating && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Service</p>
                        <StarDisplay rating={fb.service_rating} />
                      </div>
                    )}
                    {fb.cleanliness_rating && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Cleanliness</p>
                        <StarDisplay rating={fb.cleanliness_rating} />
                      </div>
                    )}
                    {fb.food_rating && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Food</p>
                        <StarDisplay rating={fb.food_rating} />
                      </div>
                    )}
                  </div>

                  {fb.translated_comment && fb.guest_language !== 'en' && (
                    <div className="bg-primary/5 rounded-lg p-3 border-l-2 border-primary">
                      <p className="text-xs text-muted-foreground mb-1">Translated</p>
                      <p className="text-sm">{fb.translated_comment}</p>
                    </div>
                  )}

                  {fb.original_comment && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">
                        Original ({fb.guest_language.toUpperCase()})
                      </p>
                      <p className="text-sm" dir={fb.guest_language === 'ar' ? 'rtl' : 'ltr'}>
                        {fb.original_comment}
                      </p>
                    </div>
                  )}

                  {fb.pdf_path && (
                    <Button variant="outline" size="sm" onClick={() => downloadPdf(fb.pdf_path!)}>
                      <Download className="w-3 h-3 mr-1" />
                      Download Report
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Feedback;
