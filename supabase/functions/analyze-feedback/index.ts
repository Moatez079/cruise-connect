import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { boat_id } = await req.json();
    if (!boat_id) {
      return new Response(JSON.stringify({ error: "boat_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all feedback for this boat
    const { data: feedbacks, error: fbErr } = await supabase
      .from("guest_feedback")
      .select("*")
      .eq("boat_id", boat_id)
      .order("created_at", { ascending: false });

    if (fbErr) throw fbErr;
    if (!feedbacks || feedbacks.length === 0) {
      return new Response(JSON.stringify({ error: "No feedback data to analyze" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch custom questions and answers
    const { data: questions } = await supabase
      .from("feedback_questions")
      .select("*")
      .eq("boat_id", boat_id);

    const fbIds = feedbacks.map((f: any) => f.id);
    const { data: answers } = await supabase
      .from("feedback_answers")
      .select("*")
      .in("feedback_id", fbIds);

    // Build stats
    const total = feedbacks.length;
    const avgOverall = feedbacks.reduce((s: number, f: any) => s + f.overall_rating, 0) / total;
    
    const serviceRatings = feedbacks.filter((f: any) => f.service_rating).map((f: any) => f.service_rating);
    const cleanRatings = feedbacks.filter((f: any) => f.cleanliness_rating).map((f: any) => f.cleanliness_rating);
    const foodRatings = feedbacks.filter((f: any) => f.food_rating).map((f: any) => f.food_rating);

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

    const departments: Record<string, { avg: number; count: number }> = {};
    if (serviceRatings.length) departments["Service"] = { avg: avg(serviceRatings)!, count: serviceRatings.length };
    if (cleanRatings.length) departments["Cleanliness"] = { avg: avg(cleanRatings)!, count: cleanRatings.length };
    if (foodRatings.length) departments["Food & Beverage"] = { avg: avg(foodRatings)!, count: foodRatings.length };
    departments["Overall Experience"] = { avg: avgOverall, count: total };

    // Custom question averages
    if (questions && answers) {
      for (const q of questions) {
        if (q.question_type === "rating") {
          const qAnswers = answers.filter((a: any) => a.question_id === q.id && a.rating_value);
          if (qAnswers.length > 0) {
            departments[q.label_en] = {
              avg: avg(qAnswers.map((a: any) => a.rating_value))!,
              count: qAnswers.length,
            };
          }
        }
      }
    }

    // Collect comments
    const comments = feedbacks
      .filter((f: any) => f.translated_comment || f.original_comment)
      .map((f: any) => f.translated_comment || f.original_comment)
      .slice(0, 30);

    // Build AI prompt
    const deptSummary = Object.entries(departments)
      .map(([name, d]) => `- ${name}: ${d.avg.toFixed(2)}/5 (${d.count} ratings)`)
      .join("\n");

    const prompt = `You are an expert hospitality consultant analyzing guest feedback for a cruise/yacht.

DATA:
Total feedback submissions: ${total}
Time period: ${feedbacks[feedbacks.length - 1].created_at.split("T")[0]} to ${feedbacks[0].created_at.split("T")[0]}

Department Ratings:
${deptSummary}

Recent Guest Comments (translated to English):
${comments.map((c: string, i: number) => `${i + 1}. "${c}"`).join("\n")}

TASK: Provide a comprehensive analysis in this exact JSON structure:
{
  "summary": "2-3 sentence executive summary of overall guest satisfaction",
  "best_departments": [{"name": "dept name", "score": 4.5, "insight": "why it's performing well"}],
  "worst_departments": [{"name": "dept name", "score": 2.1, "insight": "key issues identified"}],
  "improvements": [{"area": "specific area", "priority": "high|medium|low", "action": "concrete actionable recommendation"}],
  "trends": "1-2 sentences about notable patterns or trends",
  "guest_sentiment": "positive|mixed|negative"
}

Return ONLY valid JSON, no markdown.`;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";

    let analysis;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      analysis = JSON.parse(cleaned);
    } catch {
      analysis = { summary: content, best_departments: [], worst_departments: [], improvements: [], trends: "", guest_sentiment: "mixed" };
    }

    return new Response(JSON.stringify({ analysis, departments, total }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("analyze-feedback error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
