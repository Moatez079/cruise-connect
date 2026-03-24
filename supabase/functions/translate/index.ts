import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TranslationResult {
  translatedText: string;
  provider: string;
  confidence: number | null;
}

async function translateWithDeepSeek(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<TranslationResult> {
  const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY not configured");

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: `You are a professional translator for a luxury floating hotel. Translate the following text from ${sourceLang} to ${targetLang}. 
Rules:
- Provide ONLY the translated text, no explanations
- Keep the translation natural and context-aware (hospitality context)
- Do NOT do literal translations
- Preserve the tone and intent of the original message
- If the text is already in ${targetLang}, return it as-is`,
        },
        { role: "user", content: text },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  const translated = data.choices?.[0]?.message?.content?.trim();
  if (!translated) throw new Error("Empty translation from DeepSeek");

  return { translatedText: translated, provider: "deepseek", confidence: 0.95 };
}

async function translateWithLovableAI(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<TranslationResult> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const response = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a professional translator for a luxury floating hotel. Translate from ${sourceLang} to ${targetLang}. Return ONLY the translated text. Keep it natural, context-aware (hospitality), and non-literal. If already in ${targetLang}, return as-is.`,
          },
          { role: "user", content: text },
        ],
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Lovable AI error (${response.status}): ${err}`);
  }

  const data = await response.json();
  const translated = data.choices?.[0]?.message?.content?.trim();
  if (!translated) throw new Error("Empty translation from Lovable AI");

  return {
    translatedText: translated,
    provider: "lovable_ai",
    confidence: 0.9,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, sourceLang, targetLang } = await req.json();

    if (!text || !sourceLang || !targetLang) {
      return new Response(
        JSON.stringify({ error: "Missing text, sourceLang, or targetLang" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If source and target are the same, skip translation
    if (sourceLang === targetLang) {
      return new Response(
        JSON.stringify({
          translatedText: text,
          provider: "none",
          confidence: 1.0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Multi-layer translation: DeepSeek first, then Lovable AI as fallback
    let result: TranslationResult;
    const errors: string[] = [];

    try {
      result = await translateWithDeepSeek(text, sourceLang, targetLang);
      console.log("Translation succeeded via DeepSeek");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown DeepSeek error";
      errors.push(`DeepSeek: ${msg}`);
      console.warn("DeepSeek failed, trying Lovable AI fallback:", msg);

      try {
        result = await translateWithLovableAI(text, sourceLang, targetLang);
        console.log("Translation succeeded via Lovable AI fallback");
      } catch (e2) {
        const msg2 = e2 instanceof Error ? e2.message : "Unknown fallback error";
        errors.push(`Lovable AI: ${msg2}`);
        console.error("All translation providers failed:", errors);

        return new Response(
          JSON.stringify({
            error: "All translation providers failed",
            details: errors,
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("translate error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
