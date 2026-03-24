import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart3,
  Bot,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Lightbulb,
  Loader2,
  MessageSquare,
  RefreshCw,
  Ship,
  Star,
  TrendingUp,
} from 'lucide-react';

interface Boat {
  id: string;
  name: string;
}

interface Suggestion {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

interface Report {
  id: string;
  boat_id: string;
  report_date: string;
  total_requests: number;
  pending_requests: number;
  completed_requests: number;
  avg_feedback_score: number | null;
  total_feedbacks: number;
  request_breakdown: Record<string, number>;
  ai_summary: string | null;
  ai_suggestions: Suggestion[];
  created_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  towels: 'Towels',
  help_opening_room: 'Help Opening Room',
  cleaning: 'Cleaning',
  bathroom_service: 'Bathroom Service',
  do_not_disturb: 'Do Not Disturb',
  drinks: 'Drinks',
  custom: 'Custom Request',
};

const PRIORITY_STYLES: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  medium: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
  low: 'bg-primary/10 text-primary border-primary/20',
};

const Reports = () => {
  const [boats, setBoats] = useState<Boat[]>([]);
  const [selectedBoat, setSelectedBoat] = useState('');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [report, setReport] = useState<Report | null>(null);
  const [pastReports, setPastReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

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

  // Load existing reports when boat changes
  useEffect(() => {
    if (!selectedBoat) return;
    const fetchReports = async () => {
      const { data } = await (supabase.from('daily_reports' as any) as any)
        .select('*')
        .eq('boat_id', selectedBoat)
        .order('report_date', { ascending: false })
        .limit(10);

      if (data) {
        setPastReports(data as Report[]);
        // Load today's or selected date's report
        const todayReport = (data as Report[]).find((r) => r.report_date === reportDate);
        setReport(todayReport || null);
      }
    };
    fetchReports();
  }, [selectedBoat]);

  // Update displayed report when date changes
  useEffect(() => {
    const match = pastReports.find((r) => r.report_date === reportDate);
    setReport(match || null);
  }, [reportDate, pastReports]);

  const generateReport = async () => {
    if (!selectedBoat) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-report', {
        body: { boat_id: selectedBoat, date: reportDate },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const newReport = data.report as Report;
      setReport(newReport);

      // Update past reports list
      setPastReports((prev) => {
        const filtered = prev.filter((r) => r.report_date !== reportDate);
        return [newReport, ...filtered].sort(
          (a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime()
        );
      });

      toast({ title: 'Report generated', description: 'AI analysis complete!' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const boatName = boats.find((b) => b.id === selectedBoat)?.name || '';

  if (loading) {
    return (
      <DashboardLayout title="AI Reports" description="AI-powered daily operational insights">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="AI Reports" description="AI-powered daily operational insights">
      <div className="space-y-6">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Boat</Label>
            <Select value={selectedBoat} onValueChange={setSelectedBoat}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select boat" />
              </SelectTrigger>
              <SelectContent>
                {boats.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    <div className="flex items-center gap-2">
                      <Ship className="w-3 h-3" />
                      {b.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Date</Label>
            <Input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="w-[180px]"
            />
          </div>

          <Button onClick={generateReport} disabled={generating || !selectedBoat}>
            {generating ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
            ) : report ? (
              <><RefreshCw className="w-4 h-4 mr-2" /> Regenerate Report</>
            ) : (
              <><Bot className="w-4 h-4 mr-2" /> Generate Report</>
            )}
          </Button>
        </div>

        {/* Report Content */}
        {report ? (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="border-border/50">
                <CardContent className="pt-5 pb-4 px-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <MessageSquare className="w-4 h-4" />
                    <span className="text-xs font-medium">Requests</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{report.total_requests}</p>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="pt-5 pb-4 px-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-xs font-medium">Completed</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{report.completed_requests}</p>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="pt-5 pb-4 px-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs font-medium">Pending</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{report.pending_requests}</p>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="pt-5 pb-4 px-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Star className="w-4 h-4" />
                    <span className="text-xs font-medium">Avg Rating</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {report.avg_feedback_score !== null
                      ? Number(report.avg_feedback_score).toFixed(1)
                      : '—'}
                    <span className="text-sm text-muted-foreground font-normal">
                      {report.total_feedbacks > 0 ? ` / 5` : ''}
                    </span>
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Request Breakdown */}
            {Object.keys(report.request_breakdown || {}).length > 0 && (
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    Request Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(report.request_breakdown)
                      .sort(([, a], [, b]) => (b as number) - (a as number))
                      .map(([category, count]) => {
                        const pct = report.total_requests > 0
                          ? ((count as number) / report.total_requests) * 100
                          : 0;
                        return (
                          <div key={category} className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground w-28 truncate">
                              {CATEGORY_LABELS[category] || category}
                            </span>
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-foreground w-8 text-right">
                              {count as number}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* AI Summary */}
            {report.ai_summary && (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Bot className="w-4 h-4 text-primary" />
                    AI Executive Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-foreground/90">{report.ai_summary}</p>
                </CardContent>
              </Card>
            )}

            {/* AI Suggestions */}
            {report.ai_suggestions && report.ai_suggestions.length > 0 && (
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-yellow-500" />
                    Improvement Suggestions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {report.ai_suggestions.map((s, idx) => (
                    <div key={idx} className="flex gap-3 p-3 rounded-lg bg-muted/30">
                      <Badge
                        variant="outline"
                        className={`h-5 text-[10px] shrink-0 ${PRIORITY_STYLES[s.priority] || ''}`}
                      >
                        {s.priority}
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{s.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <Card className="border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="w-12 h-12 text-muted-foreground/20 mb-4" />
              <h3 className="text-base font-medium text-foreground mb-1">No report for this date</h3>
              <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
                Generate an AI-powered report to see request summaries, feedback scores, and improvement suggestions for {boatName}.
              </p>
              <Button onClick={generateReport} disabled={generating || !selectedBoat}>
                {generating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Bot className="w-4 h-4 mr-2" /> Generate Report</>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Past Reports */}
        {pastReports.length > 1 && (
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                Report History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pastReports.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setReportDate(r.report_date)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                      r.report_date === reportDate
                        ? 'bg-primary/10 border border-primary/20'
                        : 'bg-muted/30 hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {new Date(r.report_date + 'T00:00:00').toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r.total_requests} requests · {r.total_feedbacks} feedbacks
                        </p>
                      </div>
                    </div>
                    {r.avg_feedback_score !== null && (
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                        <span className="text-xs font-medium">{Number(r.avg_feedback_score).toFixed(1)}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Reports;
