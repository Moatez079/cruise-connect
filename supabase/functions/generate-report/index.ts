import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { boat_id, date } = await req.json();
    if (!boat_id) {
      return new Response(JSON.stringify({ error: "boat_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const reportDate = date || new Date().toISOString().split("T")[0];
    const startOfDay = `${reportDate}T00:00:00.000Z`;
    const endOfDay = `${reportDate}T23:59:59.999Z`;

    // Fetch requests for the day
    const { data: requests } = await supabase
      .from("requests")
      .select("*")
      .eq("boat_id", boat_id)
      .gte("created_at", startOfDay)
      .lte("created_at", endOfDay);

    // Fetch feedback for the day
    const { data: feedbacks } = await supabase
      .from("guest_feedback")
      .select("*")
      .eq("boat_id", boat_id)
      .gte("created_at", startOfDay)
      .lte("created_at", endOfDay);

    // Fetch boat name
    const { data: boat } = await supabase
      .from("boats")
      .select("name")
      .eq("id", boat_id)
      .single();

    const reqList = requests || [];
    const fbList = feedbacks || [];

    // Calculate stats
    const totalRequests = reqList.length;
    const pendingRequests = reqList.filter((r: any) => r.status === "pending").length;
    const completedRequests = reqList.filter((r: any) => r.status === "done").length;
    const inProgressRequests = reqList.filter((r: any) => r.status === "in_progress").length;

    const totalFeedbacks = fbList.length;
    const avgFeedbackScore = totalFeedbacks > 0
      ? fbList.reduce((sum: number, f: any) => sum + f.overall_rating, 0) / totalFeedbacks
      : null;

    // Category breakdown
    const breakdown: Record<string, number> = {};
    reqList.forEach((r: any) => {
      breakdown[r.category] = (breakdown[r.category] || 0) + 1;
    });

    // Build context for AI
    const feedbackComments = fbList
      .filter((f: any) => f.translated_comment || f.original_comment)
      .map((f: any) => `Room ${f.room_number} (${f.overall_rating}/5): ${f.translated_comment || f.original_comment}`)
      .join("\n");

    const customRequests = reqList
      .filter((r: any) => r.category === "custom" && (r.translated_message || r.original_message))
      .map((r: any) => `Room ${r.room_number}: ${r.translated_message || r.original_message}`)
      .join("\n");

    const prompt = `You are an operations analyst for a floating hotel called "${boat?.name || "Unknown"}".
Generate a concise daily operations report for ${reportDate}.

DATA:
- Total requests: ${totalRequests} (${pendingRequests} pending, ${inProgressRequests} in progress, ${completedRequests} completed)
- Request breakdown by category: ${JSON.stringify(breakdown)}
- Total feedback submissions: ${totalFeedbacks}
- Average feedback score: ${avgFeedbackScore !== null ? avgFeedbackScore.toFixed(1) + "/5" : "No feedback yet"}

${feedbackComments ? `GUEST FEEDBACK COMMENTS:\n${feedbackComments}` : "No feedback comments today."}

${customRequests ? `CUSTOM REQUESTS:\n${customRequests}` : "No custom requests today."}

Provide:
1. A brief executive summary (2-3 sentences)
2. Key highlights and concerns
3. 3-5 actionable improvement suggestions based on the data

Keep the tone professional but warm. Be specific with suggestions based on the actual data provided.`;

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a hospitality operations analyst. Generate clear, data-driven reports with actionable insights." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_report",
              description: "Generate a structured daily operations report",
              parameters: {
                type: "object",
                properties: {
                  summary: {
                    type: "string",
                    description: "Executive summary in 2-3 sentences",
                  },
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Short suggestion title" },
                        description: { type: "string", description: "Detailed actionable suggestion" },
                        priority: { type: "string", enum: ["high", "medium", "low"] },
                      },
                      required: ["title", "description", "priority"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["summary", "suggestions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_report" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errText = await aiResponse.text();
      console.error("AI gateway error:", status, errText);

      if (status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings > Workspace > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Failed to generate AI report" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let aiSummary = "";
    let aiSuggestions: any[] = [];

    // Extract structured output from tool call
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        aiSummary = parsed.summary || "";
        aiSuggestions = parsed.suggestions || [];
      } catch {
        // Fallback: use message content
        aiSummary = aiData.choices?.[0]?.message?.content || "Report generation completed.";
      }
    } else {
      aiSummary = aiData.choices?.[0]?.message?.content || "Report generation completed.";
    }

    // Upsert the report
    const { data: report, error: upsertError } = await supabase
      .from("daily_reports")
      .upsert(
        {
          boat_id,
          report_date: reportDate,
          total_requests: totalRequests,
          pending_requests: pendingRequests,
          completed_requests: completedRequests,
          avg_feedback_score: avgFeedbackScore,
          total_feedbacks: totalFeedbacks,
          request_breakdown: breakdown,
          ai_summary: aiSummary,
          ai_suggestions: aiSuggestions,
        },
        { onConflict: "boat_id,report_date" }
      )
      .select()
      .single();

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return new Response(JSON.stringify({ error: upsertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-report error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
