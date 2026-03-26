import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { generateAndUploadFeedbackPDF } from '@/lib/feedbackPdf';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Star, MessageSquare, Download, Sparkles, Loader2, Trash2, Plus, Pencil, Check, X, TrendingUp, TrendingDown, AlertTriangle, ThumbsUp, BarChart3, Brain, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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

interface FeedbackQuestion {
  id: string;
  boat_id: string;
  label: string;
  label_en: string;
  question_type: string;
  required: boolean;
  sort_order: number;
}

interface FeedbackAnswer {
  id: string;
  feedback_id: string;
  question_id: string;
  rating_value: number | null;
  text_value: string | null;
}

interface Boat { id: string; name: string; }

interface AIAnalysis {
  summary: string;
  best_departments: { name: string; score: number; insight: string }[];
  worst_departments: { name: string; score: number; insight: string }[];
  improvements: { area: string; priority: string; action: string }[];
  trends: string;
  guest_sentiment: string;
}

const StarDisplay = ({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((s) => (
      <Star
        key={s}
        className={`${size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} ${s <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/20'}`}
      />
    ))}
  </div>
);

const RatingBar = ({ label, value, count }: { label: string; value: number; count: number }) => {
  const pct = (value / 5) * 100;
  const color = value >= 4 ? 'bg-green-500' : value >= 3 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{value.toFixed(1)}/5 ({count})</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const Feedback = () => {
  const [feedbacks, setFeedbacks] = useState<FeedbackRow[]>([]);
  const [boats, setBoats] = useState<Boat[]>([]);
  const [selectedBoat, setSelectedBoat] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, FeedbackAnswer[]>>({});
  const [extracting, setExtracting] = useState(false);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [formLabel, setFormLabel] = useState('');
  const [formLabelEn, setFormLabelEn] = useState('');
  const [formType, setFormType] = useState('rating');
  const [formRequired, setFormRequired] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // AI Analysis
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [deptData, setDeptData] = useState<Record<string, { avg: number; count: number }>>({});
  const [analyzing, setAnalyzing] = useState(false);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editLabelEn, setEditLabelEn] = useState('');
  const [editType, setEditType] = useState('rating');
  const [editRequired, setEditRequired] = useState(false);

  // PDF generation state
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    const fetchBoats = async () => {
      const { data } = await supabase.from('boats').select('id, name');
      if (data) setBoats(data);
    };
    fetchBoats();
  }, []);

  useEffect(() => {
    setAnalysis(null);
    setDeptData({});
    fetchData();
  }, [selectedBoat]);

  const fetchData = async () => {
    setLoading(true);
    let query = (supabase.from('guest_feedback' as any) as any).select('*').order('created_at', { ascending: false });
    if (selectedBoat !== 'all') query = query.eq('boat_id', selectedBoat);
    const { data } = await query;
    if (data) setFeedbacks(data as FeedbackRow[]);

    if (selectedBoat !== 'all') {
      const { data: qData } = await (supabase.from('feedback_questions' as any) as any)
        .select('*').eq('boat_id', selectedBoat).order('sort_order');
      if (qData) setQuestions(qData as FeedbackQuestion[]);

      if (data && data.length > 0) {
        const fbIds = data.map((f: any) => f.id);
        const { data: aData } = await (supabase.from('feedback_answers' as any) as any)
          .select('*').in('feedback_id', fbIds);
        if (aData) {
          const grouped: Record<string, FeedbackAnswer[]> = {};
          (aData as FeedbackAnswer[]).forEach(a => {
            if (!grouped[a.feedback_id]) grouped[a.feedback_id] = [];
            grouped[a.feedback_id].push(a);
          });
          setAnswers(grouped);
        }
      }
    } else {
      setQuestions([]);
      setAnswers({});
    }
    setLoading(false);
  };

  const runAnalysis = async () => {
    if (selectedBoat === 'all') {
      toast({ title: 'Select a boat first', variant: 'destructive' });
      return;
    }
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-feedback', {
        body: { boat_id: selectedBoat },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAnalysis(data.analysis);
      setDeptData(data.departments || {});
      toast({ title: 'Analysis complete!' });
    } catch (err: any) {
      toast({ title: 'Analysis failed', description: err.message, variant: 'destructive' });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || selectedBoat === 'all') return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please upload an image.', variant: 'destructive' });
      return;
    }
    setExtracting(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `feedback_form_${selectedBoat}_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('menu-images').upload(fileName, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('menu-images').getPublicUrl(fileName);
      const { data, error } = await supabase.functions.invoke('extract-feedback', { body: { imageUrl: urlData.publicUrl } });
      if (error) throw error;
      const extracted = data?.questions || [];
      if (extracted.length === 0) {
        toast({ title: 'No questions found', variant: 'destructive' });
        return;
      }
      await (supabase.from('feedback_questions' as any) as any).delete().eq('boat_id', selectedBoat);
      const toInsert = extracted.map((q: any, idx: number) => ({
        boat_id: selectedBoat, label: q.label || q.label_en, label_en: q.label_en || q.label,
        question_type: q.question_type === 'text' ? 'text' : 'rating', required: q.required || false, sort_order: q.sort_order ?? idx,
      }));
      await (supabase.from('feedback_questions' as any) as any).insert(toInsert);
      toast({ title: `${extracted.length} questions extracted!` });
      fetchData();
    } catch (err: any) {
      toast({ title: 'Extraction failed', description: err.message, variant: 'destructive' });
    } finally {
      setExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddQuestion = async () => {
    if (!formLabelEn.trim() || selectedBoat === 'all') return;
    const { error } = await (supabase.from('feedback_questions' as any) as any).insert({
      boat_id: selectedBoat, label: formLabel.trim() || formLabelEn.trim(), label_en: formLabelEn.trim(),
      question_type: formType, required: formRequired, sort_order: questions.length,
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Question added' });
    setShowAddQuestion(false);
    setFormLabel(''); setFormLabelEn(''); setFormRequired(false);
    fetchData();
  };

  const handleDeleteQuestion = async (id: string) => {
    await (supabase.from('feedback_questions' as any) as any).delete().eq('id', id);
    fetchData();
  };

  const startEditing = (q: FeedbackQuestion) => {
    setEditingId(q.id); setEditLabel(q.label); setEditLabelEn(q.label_en);
    setEditType(q.question_type); setEditRequired(q.required);
  };
  const cancelEditing = () => setEditingId(null);
  const saveEdit = async (id: string) => {
    if (!editLabelEn.trim()) return;
    const { error } = await (supabase.from('feedback_questions' as any) as any)
      .update({ label: editLabel.trim() || editLabelEn.trim(), label_en: editLabelEn.trim(), question_type: editType, required: editRequired })
      .eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setEditingId(null);
    toast({ title: 'Question updated' });
    fetchData();
  };

  const getBoatName = (id: string) => boats.find((b) => b.id === id)?.name || 'Unknown';
  const getQuestionLabel = (qId: string) => questions.find(q => q.id === qId)?.label_en || '';

  // Computed stats
  const avgRating = feedbacks.length ? feedbacks.reduce((s, f) => s + f.overall_rating, 0) / feedbacks.length : 0;
  const avgService = (() => { const r = feedbacks.filter(f => f.service_rating).map(f => f.service_rating!); return r.length ? r.reduce((a, b) => a + b, 0) / r.length : 0; })();
  const avgClean = (() => { const r = feedbacks.filter(f => f.cleanliness_rating).map(f => f.cleanliness_rating!); return r.length ? r.reduce((a, b) => a + b, 0) / r.length : 0; })();
  const avgFood = (() => { const r = feedbacks.filter(f => f.food_rating).map(f => f.food_rating!); return r.length ? r.reduce((a, b) => a + b, 0) / r.length : 0; })();

  const ratingDistribution = [1, 2, 3, 4, 5].map(r => ({
    rating: `${r}★`,
    count: feedbacks.filter(f => f.overall_rating === r).length,
    fill: r >= 4 ? 'hsl(var(--primary))' : r >= 3 ? 'hsl(45 93% 47%)' : 'hsl(var(--destructive))',
  }));

  const downloadPdf = async (path: string) => {
    const { data } = supabase.storage.from('feedback-pdfs').getPublicUrl(path);
    window.open(data.publicUrl, '_blank');
  };

  const generatePdfForFeedback = async (fb: FeedbackRow) => {
    setGeneratingPdfId(fb.id);
    try {
      const fbAnswers = answers[fb.id] || [];
      const customAnswersMapped = fbAnswers.map(a => ({
        question_label: getQuestionLabel(a.question_id),
        question_type: questions.find(q => q.id === a.question_id)?.question_type || 'rating',
        rating_value: a.rating_value,
        text_value: a.text_value,
      }));

      const fileName = await generateAndUploadFeedbackPDF(
        { ...fb, boat_name: getBoatName(fb.boat_id) },
        customAnswersMapped
      );

      setFeedbacks(prev => prev.map(f => f.id === fb.id ? { ...f, pdf_path: fileName } : f));
      toast({ title: 'PDF generated!' });
    } catch (err: any) {
      toast({ title: 'PDF failed', description: err.message, variant: 'destructive' });
    } finally {
      setGeneratingPdfId(null);
    }
  };

  const generateAllPdfs = async () => {
    const missing = feedbacks.filter(f => !f.pdf_path);
    if (missing.length === 0) {
      toast({ title: 'All responses already have PDFs' });
      return;
    }
    setBulkGenerating(true);
    setBulkProgress({ done: 0, total: missing.length });

    for (const fb of missing) {
      try {
        const fbAnswers = answers[fb.id] || [];
        const customAnswersMapped = fbAnswers.map(a => ({
          question_label: getQuestionLabel(a.question_id),
          question_type: questions.find(q => q.id === a.question_id)?.question_type || 'rating',
          rating_value: a.rating_value,
          text_value: a.text_value,
        }));

        const fileName = await generateAndUploadFeedbackPDF(
          { ...fb, boat_name: getBoatName(fb.boat_id) },
          customAnswersMapped
        );
        setFeedbacks(prev => prev.map(f => f.id === fb.id ? { ...f, pdf_path: fileName } : f));
      } catch (err) {
        console.warn(`PDF failed for ${fb.id}:`, err);
      }
      setBulkProgress(prev => ({ ...prev, done: prev.done + 1 }));
    }

    setBulkGenerating(false);
    toast({ title: `Generated ${missing.length} PDFs!` });
  };

  const sentimentColor = (s: string) => s === 'positive' ? 'text-green-600' : s === 'negative' ? 'text-red-600' : 'text-yellow-600';
  const sentimentIcon = (s: string) => s === 'positive' ? <ThumbsUp className="w-5 h-5" /> : s === 'negative' ? <TrendingDown className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />;
  const priorityColor = (p: string) => p === 'high' ? 'bg-red-100 text-red-700 border-red-200' : p === 'medium' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-green-100 text-green-700 border-green-200';

  return (
    <DashboardLayout title="Guest Feedback" description="Analyze feedback and manage forms">
      <div className="space-y-6">
        {/* Header controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <Select value={selectedBoat} onValueChange={setSelectedBoat}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Boats" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Boats</SelectItem>
              {boats.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>

          {selectedBoat !== 'all' && feedbacks.length > 0 && (
            <Button onClick={runAnalysis} disabled={analyzing} variant="default">
              {analyzing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing...</> : <><Brain className="w-4 h-4 mr-2" />AI Analysis</>}
            </Button>
          )}
        </div>

        {/* Stats Overview */}
        {!loading && feedbacks.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-muted-foreground mb-1">Total Reviews</p>
                <p className="text-2xl font-bold">{feedbacks.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-muted-foreground mb-1">Overall Rating</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{avgRating.toFixed(1)}</p>
                  <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-muted-foreground mb-1">With Comments</p>
                <p className="text-2xl font-bold">{feedbacks.filter(f => f.original_comment).length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-muted-foreground mb-1">5-Star Rate</p>
                <p className="text-2xl font-bold">{feedbacks.length ? Math.round((feedbacks.filter(f => f.overall_rating === 5).length / feedbacks.length) * 100) : 0}%</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="responses">Responses ({feedbacks.length})</TabsTrigger>
            <TabsTrigger value="form" disabled={selectedBoat === 'all'}>Feedback Form</TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-6">
            {loading ? (
              <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}</div>
            ) : feedbacks.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <MessageSquare className="w-12 h-12 text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">No feedback yet</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Department Ratings */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" /> Department Ratings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {avgRating > 0 && <RatingBar label="Overall" value={avgRating} count={feedbacks.length} />}
                      {avgService > 0 && <RatingBar label="Service" value={avgService} count={feedbacks.filter(f => f.service_rating).length} />}
                      {avgClean > 0 && <RatingBar label="Cleanliness" value={avgClean} count={feedbacks.filter(f => f.cleanliness_rating).length} />}
                      {avgFood > 0 && <RatingBar label="Food & Beverage" value={avgFood} count={feedbacks.filter(f => f.food_rating).length} />}
                    </CardContent>
                  </Card>

                  {/* Rating Distribution */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Rating Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={ratingDistribution}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="rating" tick={{ fontSize: 12 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {ratingDistribution.map((entry, index) => (
                              <Cell key={index} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                {/* AI Analysis Results */}
                {analysis && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Brain className="w-5 h-5 text-primary" /> AI Analysis
                    </h3>

                    {/* Summary & Sentiment */}
                    <Card>
                      <CardContent className="pt-4 space-y-3">
                        <div className={`flex items-center gap-2 ${sentimentColor(analysis.guest_sentiment)}`}>
                          {sentimentIcon(analysis.guest_sentiment)}
                          <span className="font-medium capitalize">{analysis.guest_sentiment} Sentiment</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{analysis.summary}</p>
                        {analysis.trends && (
                          <p className="text-sm italic border-l-2 border-primary pl-3">{analysis.trends}</p>
                        )}
                      </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Best Departments */}
                      {analysis.best_departments.length > 0 && (
                        <Card className="border-green-200">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                              <TrendingUp className="w-4 h-4" /> Top Performing
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {analysis.best_departments.map((d, i) => (
                              <div key={i} className="flex items-start gap-3">
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 shrink-0">
                                  {d.score.toFixed(1)}★
                                </Badge>
                                <div>
                                  <p className="text-sm font-medium">{d.name}</p>
                                  <p className="text-xs text-muted-foreground">{d.insight}</p>
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      )}

                      {/* Worst Departments */}
                      {analysis.worst_departments.length > 0 && (
                        <Card className="border-red-200">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2 text-red-700">
                              <TrendingDown className="w-4 h-4" /> Needs Attention
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {analysis.worst_departments.map((d, i) => (
                              <div key={i} className="flex items-start gap-3">
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 shrink-0">
                                  {d.score.toFixed(1)}★
                                </Badge>
                                <div>
                                  <p className="text-sm font-medium">{d.name}</p>
                                  <p className="text-xs text-muted-foreground">{d.insight}</p>
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      )}
                    </div>

                    {/* Improvements */}
                    {analysis.improvements.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" /> Recommended Improvements
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {analysis.improvements.map((imp, i) => (
                              <div key={i} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                                <Badge className={`shrink-0 text-xs ${priorityColor(imp.priority)}`}>
                                  {imp.priority}
                                </Badge>
                                <div>
                                  <p className="text-sm font-medium">{imp.area}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{imp.action}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {!analysis && selectedBoat !== 'all' && (
                  <Card className="border-dashed border-2">
                    <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                      <Brain className="w-10 h-10 text-muted-foreground/30 mb-3" />
                      <h3 className="text-base font-semibold mb-1">AI-Powered Analysis</h3>
                      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                        Get insights on best/worst departments, guest sentiment, and actionable improvement recommendations.
                      </p>
                      <Button onClick={runAnalysis} disabled={analyzing}>
                        {analyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />}
                        Run Analysis
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* RESPONSES TAB */}
          <TabsContent value="responses" className="space-y-4">
            {loading ? (
              <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}</div>
            ) : feedbacks.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <MessageSquare className="w-12 h-12 text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">No feedback yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Bulk generate button */}
                {feedbacks.some(f => !f.pdf_path) && (
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      onClick={generateAllPdfs}
                      disabled={bulkGenerating}
                    >
                      {bulkGenerating ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating {bulkProgress.done}/{bulkProgress.total}...</>
                      ) : (
                        <><FileText className="w-4 h-4 mr-2" />Generate All PDFs ({feedbacks.filter(f => !f.pdf_path).length} missing)</>
                      )}
                    </Button>
                  </div>
                )}
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

                      {answers[fb.id] && answers[fb.id].length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-border/30">
                          {answers[fb.id].map(a => (
                            <div key={a.id}>
                              <p className="text-xs text-muted-foreground mb-1">{getQuestionLabel(a.question_id)}</p>
                              {a.rating_value ? <StarDisplay rating={a.rating_value} /> : <p className="text-sm">{a.text_value || '—'}</p>}
                            </div>
                          ))}
                        </div>
                      )}

                      {fb.translated_comment && fb.guest_language !== 'en' && (
                        <div className="bg-primary/5 rounded-lg p-3 border-l-2 border-primary">
                          <p className="text-xs text-muted-foreground mb-1">Translated</p>
                          <p className="text-sm">{fb.translated_comment}</p>
                        </div>
                      )}

                      {fb.original_comment && (
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-1">Original ({fb.guest_language.toUpperCase()})</p>
                          <p className="text-sm" dir={fb.guest_language === 'ar' ? 'rtl' : 'ltr'}>{fb.original_comment}</p>
                        </div>
                      )}

                      {fb.pdf_path && (
                        <Button variant="outline" size="sm" onClick={() => downloadPdf(fb.pdf_path!)}>
                          <Download className="w-3 h-3 mr-1" />Download Report
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* FEEDBACK FORM TAB */}
          <TabsContent value="form" className="space-y-4">
            {selectedBoat !== 'all' && (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={extracting}>
                    {extracting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Extracting...</> : <><Sparkles className="w-4 h-4 mr-2" />Upload Form Image</>}
                  </Button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  <Button onClick={() => { setFormLabel(''); setFormLabelEn(''); setFormType('rating'); setFormRequired(false); setShowAddQuestion(true); }}>
                    <Plus className="w-4 h-4 mr-2" />Add Question
                  </Button>
                </div>

                {questions.length === 0 ? (
                  <Card className="border-dashed border-2 border-border/50">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                      <Sparkles className="w-12 h-12 text-muted-foreground/30 mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No custom feedback form</h3>
                      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                        Upload a photo of your feedback form and AI will extract the questions, or add questions manually.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-border/50">
                    <CardHeader>
                      <CardTitle className="text-base">Custom Questions ({questions.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Question (EN)</TableHead>
                            <TableHead>Original Label</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Required</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {questions.map((q, idx) => (
                            <TableRow key={q.id}>
                              <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                              {editingId === q.id ? (
                                <>
                                  <TableCell><Input value={editLabelEn} onChange={e => setEditLabelEn(e.target.value)} className="h-8 text-sm" /></TableCell>
                                  <TableCell><Input value={editLabel} onChange={e => setEditLabel(e.target.value)} className="h-8 text-sm" /></TableCell>
                                  <TableCell>
                                    <Select value={editType} onValueChange={setEditType}>
                                      <SelectTrigger className="h-8 text-xs w-[100px]"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="rating">⭐ Rating</SelectItem>
                                        <SelectItem value="text">💬 Text</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell><Switch checked={editRequired} onCheckedChange={setEditRequired} /></TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                      <Button variant="ghost" size="icon" onClick={() => saveEdit(q.id)} className="text-green-600 h-8 w-8"><Check className="w-4 h-4" /></Button>
                                      <Button variant="ghost" size="icon" onClick={cancelEditing} className="h-8 w-8"><X className="w-4 h-4" /></Button>
                                    </div>
                                  </TableCell>
                                </>
                              ) : (
                                <>
                                  <TableCell><span className="font-medium">{q.label_en}</span></TableCell>
                                  <TableCell><span className="text-xs text-muted-foreground">{q.label !== q.label_en ? q.label : '—'}</span></TableCell>
                                  <TableCell><Badge variant="outline" className="text-xs">{q.question_type === 'rating' ? '⭐ Rating' : '💬 Text'}</Badge></TableCell>
                                  <TableCell>{q.required ? 'Yes' : 'No'}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                      <Button variant="ghost" size="icon" onClick={() => startEditing(q)} className="h-8 w-8"><Pencil className="w-4 h-4" /></Button>
                                      <Button variant="ghost" size="icon" onClick={() => handleDeleteQuestion(q.id)} className="text-destructive h-8 w-8"><Trash2 className="w-4 h-4" /></Button>
                                    </div>
                                  </TableCell>
                                </>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Question Dialog */}
      <Dialog open={showAddQuestion} onOpenChange={setShowAddQuestion}>
        <DialogContent onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>Add Question</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Question (English) *</Label>
              <Input value={formLabelEn} onChange={e => setFormLabelEn(e.target.value)} placeholder="e.g. How was the entertainment?" autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Original Label (optional)</Label>
              <Input value={formLabel} onChange={e => setFormLabel(e.target.value)} placeholder="Original language label" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rating">⭐ Rating (1-5 stars)</SelectItem>
                  <SelectItem value="text">💬 Text (free comment)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formRequired} onCheckedChange={setFormRequired} />
              <Label>Required</Label>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddQuestion} disabled={!formLabelEn.trim()}>Add Question</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Feedback;
