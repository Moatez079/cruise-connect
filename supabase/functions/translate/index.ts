import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TranslationResult {
  translatedText: string;
  provider: string;
  confidence: number;
}

// ── Layer 1: Lovable AI (free tier included) ──
async function translateWithLovableAI(
  text: string, sourceLang: string, targetLang: string
): Promise<TranslationResult> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "system",
          content: `You are a professional translator for a luxury floating hotel. Translate from ${sourceLang} to ${targetLang}. Return ONLY the translated text — no explanations, no quotes. Keep it natural, context-aware (hospitality), non-literal. If already in ${targetLang}, return as-is.`,
        },
        { role: "user", content: text },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Lovable AI error (${response.status}): ${err}`);
  }

  const data = await response.json();
  const translated = data.choices?.[0]?.message?.content?.trim();
  if (!translated) throw new Error("Empty response from Lovable AI");

  return { translatedText: translated, provider: "lovable_ai", confidence: 0.92 };
}

// ── Layer 2: MyMemory API (free, 5000 chars/day, no key) ──
async function translateWithMyMemory(
  text: string, sourceLang: string, targetLang: string
): Promise<TranslationResult> {
  const langPair = `${sourceLang}|${targetLang}`;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langPair)}`;

  const response = await fetch(url);
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`MyMemory error (${response.status}): ${err}`);
  }

  const data = await response.json();
  if (data.responseStatus !== 200) {
    throw new Error(`MyMemory returned status ${data.responseStatus}: ${data.responseDetails}`);
  }

  const translated = data.responseData?.translatedText;
  if (!translated) throw new Error("Empty response from MyMemory");

  const match = parseFloat(data.responseData?.match) || 0;
  return { translatedText: translated, provider: "mymemory", confidence: Math.min(match, 1) };
}

// ── Layer 3: Lingva Translate (free, open-source Google Translate proxy) ──
async function translateWithLingva(
  text: string, sourceLang: string, targetLang: string
): Promise<TranslationResult> {
  // Try multiple Lingva instances for reliability
  const instances = [
    "https://lingva.ml",
    "https://lingva.thedaviddelta.com",
  ];

  let lastError = "";
  for (const baseUrl of instances) {
    try {
      const url = `${baseUrl}/api/v1/${sourceLang}/${targetLang}/${encodeURIComponent(text)}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });

      if (!response.ok) {
        const err = await response.text();
        lastError = `Lingva (${baseUrl}) error (${response.status}): ${err}`;
        continue;
      }

      const data = await response.json();
      if (!data.translation) {
        lastError = `Empty response from Lingva (${baseUrl})`;
        continue;
      }

      return { translatedText: data.translation, provider: "lingva", confidence: 0.85 };
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Unknown Lingva error";
    }
  }

  throw new Error(`All Lingva instances failed. Last: ${lastError}`);
}

// ── Layer 4: LibreTranslate (free public instances, no key) ──
async function translateWithLibreTranslate(
  text: string, sourceLang: string, targetLang: string
): Promise<TranslationResult> {
  const instances = [
    "https://libretranslate.com",
    "https://translate.argosopentech.com",
    "https://translate.terraprint.co",
  ];

  let lastError = "";
  for (const baseUrl of instances) {
    try {
      const response = await fetch(`${baseUrl}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: text,
          source: sourceLang,
          target: targetLang,
          format: "text",
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        const err = await response.text();
        lastError = `LibreTranslate (${baseUrl}) error (${response.status}): ${err}`;
        continue;
      }

      const data = await response.json();
      if (!data.translatedText) {
        lastError = `Empty response from LibreTranslate (${baseUrl})`;
        continue;
      }

      return { translatedText: data.translatedText, provider: "libretranslate", confidence: 0.8 };
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Unknown LibreTranslate error";
    }
  }

  throw new Error(`All LibreTranslate instances failed. Last: ${lastError}`);
}

// ── Main handler with 4-layer failsafe pipeline ──
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

    // Skip translation if same language
    if (sourceLang === targetLang) {
      return new Response(
        JSON.stringify({ translatedText: text, provider: "none", confidence: 1.0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4-layer translation pipeline (priority order)
    const layers = [
      { name: "Lovable AI", fn: translateWithLovableAI },
      { name: "MyMemory", fn: translateWithMyMemory },
      { name: "Lingva", fn: translateWithLingva },
      { name: "LibreTranslate", fn: translateWithLibreTranslate },
    ];

    const errors: string[] = [];

    for (const layer of layers) {
      try {
        const result = await layer.fn(text, sourceLang, targetLang);
        console.log(`✅ Translation succeeded via ${layer.name}`);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : `Unknown ${layer.name} error`;
        errors.push(`${layer.name}: ${msg}`);
        console.warn(`⚠️ ${layer.name} failed, trying next layer:`, msg);
      }
    }

    // All layers failed
    console.error("❌ All 4 translation layers failed:", errors);
    return new Response(
      JSON.stringify({ error: "All translation providers failed", details: errors }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("translate error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
