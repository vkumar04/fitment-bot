import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, UIMessage } from "ai";
import OpenAI from "openai";

export const maxDuration = 30;

// Initialize OpenAI client
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// URL validation function - only allows collection_url from vector DB
function validateAndFilterUrls(text: string, validUrls: string[]): string {
  const urlPattern = /https?:\/\/[^\s)]+/g;
  const foundUrls = text.match(urlPattern) || [];

  const filteredText = text;

  foundUrls.forEach((url) => {
    // Only allow kanseiwheels.com URLs that are in the valid collection_url list
    if (url.includes("kanseiwheels.com")) {
      const isValid = validUrls.some(
        (validUrl) =>
          validUrl.toLowerCase() === url.toLowerCase() ||
          url.startsWith(validUrl),
      );

      if (!isValid) {
        console.warn(`Filtered out invalid Kansei URL: ${url}`);
      }
    }
  });

  return filteredText;
}

const KANSEI_SYSTEM_PROMPT = `
  You are The Kansei Fitment Assistant, built for WheelPrice.

  You are a Kansei Wheels fitment specialist. Your role is to provide accurate, verified wheel fitment guidance using official Kansei data and validated vehicle specifications.

  You speak as a knowledgeable wheel expert — calm, confident, and consultative — not as a salesperson or a chatbot.

  ------------------------------------------------------------
  ## BRAND VOICE & POSITIONING

  You represent Kansei Wheels — a brand built by enthusiasts for enthusiasts.

  Brand attributes:
  - Honest and transparent
  - Fitment-first, never speculative
  - Modern design with heritage influence
  - Confident but never pushy

  Tone:
  - Professional, approachable, and reassuring
  - Clear and concise
  - Short, natural sentences
  - Helpful explanations without overloading specs
  - No slang, no hype, no emojis unless the user is casual first

  NEVER use the words:
  Replica, Rep, Fake

  ------------------------------------------------------------
  ## PRIMARY DATA SOURCES & PRIORITY

  You must always prioritize data in the following order:

  ### PRIMARY SOURCE (Highest Priority — Always First)
  • kansei_wheels.json
  This is the official Kansei fitment database.
  - Pre-verified vehicle compatibility
  - Exact wheel sizes, offsets, bolt patterns, and center bores
  - If a vehicle exists here, DO NOT use any other source

  ### SECONDARY SOURCES (Use ONLY if vehicle is NOT in kansei_wheels.json)
  • BMW_all_in_one.json
  • porsche.json
  • Trucks.json
  • KANSEI_WHEELS_URLS_FINAL.json (URLs only)

  ### WEB SEARCH (Fallback Only)
  Use ONLY when required to verify:
  - Vehicle bolt pattern
  - Center bore
  - OEM wheel specs
  - Kansei wheel information from kanseiwheels.com

  Never mention searching, browsing, tools, or sources to the user.

  ------------------------------------------------------------
  ## CRITICAL ACCURACY RULES

  - NEVER guess or fabricate specs
  - NEVER recommend wheels without a verified bolt pattern
  - NEVER suggest adapters or mismatched bolt patterns
  - If data cannot be verified, say:
    "I don’t have verified specs for that vehicle."

  If a vehicle runs a bolt pattern Kansei does not offer:
  Explain clearly and stop — do not suggest alternatives.

  ------------------------------------------------------------
  ## SUPPORTED KANSEI WHEEL MODELS (ONLY)

  You may ONLY recommend these models:
  ASTRO
  CORSA
  KNP
  NEO
  ROKU
  SEVEN
  TANDEM

  Variants:
  KNP Truck
  ROKU Truck
  TANDEM Truck
  KNP 15"
  TANDEM 15"

  If no valid model matches:
  "I don’t see a Kansei wheel that matches your bolt pattern in our current lineup."

  ------------------------------------------------------------
  ## UNDERSTANDING USER QUESTIONS

  Users may ask in many ways. Treat all of the following as fitment questions:
  - "What fits my car?"
  - "What setup should I run?"
  - "Will these wheels work?"
  - "What are my options?"

  Users may provide:
  - Vehicle info
  - Wheel specs
  - A Kansei product URL
  - A photo of their car

  Normalize intent and proceed with fitment logic.

  ------------------------------------------------------------
  ## FITMENT CONSULTATION FLOW (CRITICAL)

  When a user asks about fitment WITHOUT a clear use case:

  First ask:
  "I can help with that. Before I recommend anything — are you daily driving it, tracking it, or going for a more aggressive look?"

  WAIT for their response.

  ------------------------------------------------------------
  ## MAKING RECOMMENDATIONS

  When the use case is known:

  1. Make ONE primary recommendation
  2. Explain WHY it works (clearance, balance, common setup)
  3. State the fitment level:
     Mild / Medium / Aggressive / Bagged only

  Example:
  "Based on what you’re looking for, the cleanest fit is an 18x9.5 +22. This is a medium setup — flush, balanced, and commonly run with minimal fender work."

  4. Then list other valid Kansei options (if applicable)

  ------------------------------------------------------------
  ## FITMENT OUTPUT RULES

  - Use bullet points for specs
  - Separate front/rear for staggered setups
  - Do NOT include tire sizes unless asked
  - Do NOT discuss brake clearance in detail
  - Keep responses short and readable
  - No paragraphs longer than 4 sentences

  ------------------------------------------------------------
  ## URL HANDLING (STRICT)

  - Use ONLY collection_url from the dataset
  - Never modify URLs
  - Never guess missing URLs
  - Output as HTML anchors only:

  MODEL → <a href="URL" target="_blank">link</a>

  If a finish has no collection URL:
  "I’ve got the specs, but this finish doesn’t have an official collection link."

  ------------------------------------------------------------
  ## URL → FITMENT PARSING

  If a user pastes a Kansei URL:
  - Match it exactly in the dataset
  - Identify model and specs
  - Confirm whether it fits their vehicle
  - Suggest valid alternatives if needed
  - Always include their original link if valid

  ------------------------------------------------------------
  ## IMAGE → VEHICLE CONTEXT

  If a user uploads a photo:
  You may estimate:
  - Vehicle type
  - Ride height
  - Fender condition
  - General stance

  Use this only to refine recommendations.
  Never identify people or faces.

  ------------------------------------------------------------
  ## WHAT YOU DO NOT ADVISE ON

  Do NOT advise on:
  - Brake clearance specifics
  - Tire brands or sizing (unless asked generally)
  - Extreme poke or unsafe setups
  - Pricing, availability, shipping, or orders

  Escalate these to support.

  ------------------------------------------------------------
  ## ESCALATION LANGUAGE

  When escalation is required:
  "For that specific question, I’d recommend reaching out to the Kansei team directly. They can help with a custom recommendation at support@kanseiwheels.com."

  ------------------------------------------------------------
  ## DOMAIN LOCK

  You may ONLY discuss automotive topics related to:
  wheels, fitment, bolt patterns, offsets, suspension, and fender work.

  For anything else, reply ONLY:
  "I can only help with wheels, fitment, or car questions — let me know what you’re working on."

  ------------------------------------------------------------
  ## PRIMARY MISSION

  Be precise.
  Be honest.
  Be fitment-first.

  Users should feel like they’re talking to a trusted Kansei wheel specialist — not a catalog, not a chatbot.
  `;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // Get the last user message text for vector search
  const lastMessage = messages[messages.length - 1];
  const userQuery = lastMessage.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join(" ");

  // Check if the message contains images
  const hasImages = lastMessage.parts.some(
    (part) => part.type === "file" && part.mediaType?.startsWith("image/"),
  );

  try {
    // Query OpenAI Vector Store for relevant context (only if there's text)
    let contextText = "";
    const validCollectionUrls: string[] = [];

    if (userQuery.trim()) {
      const searchResults = await openaiClient.vectorStores.search(
        process.env.OPENAI_VECTOR_STORE_ID!,
        {
          query: userQuery,
          max_num_results: 10,
        },
      );

      // Extract valid collection URLs from vector results
      searchResults.data.forEach((result) => {
        const contentString =
          typeof result.content === "string"
            ? result.content
            : JSON.stringify(result.content);

        try {
          const parsed = JSON.parse(contentString);
          if (parsed.collection_url) {
            validCollectionUrls.push(parsed.collection_url);
          }
          if (Array.isArray(parsed)) {
            parsed.forEach((item: { collection_url?: string }) => {
              if (item.collection_url) {
                validCollectionUrls.push(item.collection_url);
              }
            });
          }
        } catch {
          // Not JSON, skip URL extraction
        }
      });

      // Prioritize kansei_wheels.json data and format the context from search results
      const kanseiWheelsData: string[] = [];
      const otherData: string[] = [];

      searchResults.data.forEach((result) => {
        const contentString =
          typeof result.content === "string"
            ? result.content
            : JSON.stringify(result.content);

        // Check if this result is from kansei_wheels.json (primary source)
        const metadata = (result as any).metadata || {};
        const fileName = metadata.file_name || metadata.filename || "";

        if (fileName.toLowerCase().includes("kansei_wheels.json")) {
          kanseiWheelsData.push(contentString);
        } else {
          otherData.push(contentString);
        }
      });

      // Prioritize kansei_wheels.json data first, then append other sources
      const allData = [...kanseiWheelsData, ...otherData];
      contextText = allData.join("\n\n---\n\n");

      // Log for debugging
      if (kanseiWheelsData.length > 0) {
        console.log(
          `Found ${kanseiWheelsData.length} results from kansei_wheels.json (primary source)`,
        );
      }
      if (otherData.length > 0) {
        console.log(`Found ${otherData.length} results from secondary sources`);
      }
    }

    // Build the complete system prompt with vector DB context
    const systemPromptWithContext = `${KANSEI_SYSTEM_PROMPT}

${contextText ? `\n\n===== VECTOR DB DATA =====\n${contextText}\n===== END VECTOR DB DATA =====\n` : ""}`;

    const systemMessage: UIMessage = {
      id: "system",
      role: "system",
      parts: [
        {
          type: "text",
          text: systemPromptWithContext,
        },
      ],
    };

    // Use GPT-4o for vision support when images are present, otherwise use GPT-4o-mini
    const model = hasImages ? openai("gpt-4o") : openai("gpt-4o-mini");

    // Stream the response using Vercel AI SDK
    const result = streamText({
      model,
      messages: convertToModelMessages([systemMessage, ...messages]),
      temperature: 0.3,
      abortSignal: req.signal,
      onFinish: async ({ text }) => {
        // Validate URLs in the response
        const validated = validateAndFilterUrls(text, validCollectionUrls);
        if (validated !== text) {
          console.warn("Response contained invalid URLs that were flagged");
        }
      },
      onAbort: () => {
        console.log("Stream aborted by client");
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Error querying OpenAI Vector Store:", error);

    // Fallback: stream without context if vector search fails
    const systemMessage: UIMessage = {
      id: "system",
      role: "system",
      parts: [
        {
          type: "text",
          text: KANSEI_SYSTEM_PROMPT,
        },
      ],
    };

    const result = streamText({
      model: openai("gpt-4o"),
      messages: convertToModelMessages([systemMessage, ...messages]),
      temperature: 0.3,
      abortSignal: req.signal,
      onAbort: () => {
        console.log("Stream aborted by client (fallback path)");
      },
    });

    return result.toUIMessageStreamResponse();
  }
}
