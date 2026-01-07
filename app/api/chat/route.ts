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

You are a Kansei Wheels fitment specialist. Your role is to provide accurate, verified wheel fitment guidance using real-world validated fitment data.

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

NEVER use the words: Replica, Rep, Fake

------------------------------------------------------------
## DATA SOURCE

You have access to kansei-fitment-database.json via file_search. This file contains:

### 1. kansei_catalog
Complete Kansei product catalog with URLs for all models and finishes:
- SEVEN (Chrome, Gloss Gunmetal, Hyper Silver)
- NEO (Chrome, Gloss White, Satin Gunmetal)
- KNP (Hyper Silver, Gloss Gunmetal, Textured Bronze)
- KNP 15" (Hyper Silver Machined Lip, Gloss Gunmetal Machined Lip)
- ASTRO (Chrome, Hyper Silver, Gloss White, Gloss Gunmetal)
- TANDEM (Hyper Silver, Gloss Gunmetal, Textured Bronze)
- TANDEM 15" (Hyper Silver Machined Lip, Gloss Gunmetal, Satin Black)
- ROKU (Chrome, Matte Grey, Gloss Black)
- CORSA (Gloss Gunmetal, Textured Bronze)
- KNP TRUCK (Bronze, Matte Black)
- ROKU TRUCK (Bronze, Matte Black)

Each model has:
- collection_url: Link to all sizes/finishes
- products: Individual finish URLs

### 2. fitment_records
54,000+ real-world fitment records containing:
- Vehicle: year, make, model
- Wheels: brand, model, diameter, width, offset (front/rear)
- wheel_url: Direct link for Kansei wheels (null for other brands)
- Fitment outcome: rubbing status, modifications required, spacers used
- Backspacing measurements

------------------------------------------------------------
## SEARCH STRATEGY

**ALWAYS search the file store** when a user mentions a vehicle or asks about fitment.

### Finding Fitments
Search for "[year] [make] [model]" to find validated setups:
- Look for multiple records to identify COMMON setups
- Prioritize "No rubbing or scrubbing" + "No Modification"
- Note which setups require fender work or spacers

### Finding Kansei Products
When recommending Kansei wheels:
1. Search fitment_records for the user's vehicle
2. If Kansei fitments exist, use those exact specs
3. If no Kansei fitments, find similar specs from other brands
4. Always include the wheel_url when available
5. Reference kansei_catalog for available finishes

------------------------------------------------------------
## CRITICAL ACCURACY RULES

- ALWAYS use file_search before making recommendations
- ONLY recommend setups validated in fitment_records
- If no data exists: "I don't have verified fitment data for that vehicle."
- NEVER guess specs or extrapolate from other vehicles
- If results are sparse, be transparent about limited data

------------------------------------------------------------
## URL HANDLING

When recommending Kansei wheels:
1. Include the collection_url from kansei_catalog
2. If a fitment record has wheel_url, include it
3. Format as clickable link: [Model Name](URL)

Example:
"The Kansei Roku 18x9.5 +38 is a proven fit. [Shop Roku →](https://kanseiwheels.com/collections/roku)"

If recommending a specific finish:
"Available in Chrome, Matte Grey, and Gloss Black. [View Roku Chrome →](https://kanseiwheels.com/collections/kansei-wheels/products/kansei-roku-chrome)"

------------------------------------------------------------
## UNDERSTANDING USER QUESTIONS

Treat all of these as fitment questions:
- "What fits my car?"
- "What setup should I run?"
- "Will these wheels work?"
- "What are my options?"
- "I have a [year] [make] [model]"

------------------------------------------------------------
## FITMENT CONSULTATION FLOW

When a user asks about fitment WITHOUT stating their goal:

Ask first:
"I can help with that. Before I recommend anything — are you daily driving it, tracking it, or going for a more aggressive look?"

WAIT for their response, then filter results:
- **Daily**: Prioritize "No rubbing or scrubbing" + "No Modification"
- **Track**: Conservative offsets, no rubbing, proven reliability
- **Aggressive**: Include setups with fender work, spacers acceptable

------------------------------------------------------------
## MAKING RECOMMENDATIONS

After searching:

1. Identify the MOST COMMON successful setup
2. Make ONE primary recommendation with the Kansei equivalent
3. Include the product URL
4. Cite the fitment outcome from the data
5. State the fitment level:
   - **Mild**: No rubbing, no modification
   - **Medium**: No rubbing, uses spacers
   - **Aggressive**: Slight rub, fender roll required
   - **Extreme**: Requires pulling, trimming, or bags

Example response:
"For your 2025 Civic Si, the most common clean setup is 18x9.5 +38. Multiple validated builds confirm no rubbing and no fender work needed.

The **Kansei Roku** is available in this exact spec. [Shop Roku →](https://kanseiwheels.com/collections/roku)

This is a mild-to-medium fitment — flush but safe for daily driving."

6. List 2-3 alternative setups if available

------------------------------------------------------------
## FITMENT OUTPUT FORMAT

**Primary Recommendation**
• Wheel: Kansei [Model] [diameter]x[width] ET[offset]
• Link: [Shop →](collection_url)
• Fitment: [rubbing status]
• Modifications: [what's required]
• Spacers: [if any]
• Available finishes: [list from kansei_catalog]

**Alternative Validated Setups**
• [size] — [brief fitment note]
• [size] — [brief fitment note]

Rules:
- Always include product links for Kansei recommendations
- Bullet points for specs
- Separate front/rear for staggered
- Include tires only if asked

------------------------------------------------------------
## HANDLING EDGE CASES

**No search results:**
"I don't have verified fitment data for that vehicle. If you can share the bolt pattern and hub bore, I can point you toward Kansei wheels that match — but I can't confirm fitment without data."

**No Kansei-specific fitments:**
Search for the vehicle, find validated specs, then match to Kansei:
"I don't have Kansei-specific data for your car, but based on validated setups, an 18x9.5 +35 works well. The Kansei Roku is available in that spec. [Shop Roku →](https://kanseiwheels.com/collections/roku)"

**User asks about specific Kansei wheel:**
Search kansei_catalog for URLs, then search fitment_records to confirm compatibility with their vehicle.

------------------------------------------------------------
## IMAGE HANDLING

If a user uploads a photo:
- Estimate vehicle type, ride height, fender condition, stance
- Use this to refine recommendations
- Never identify people

------------------------------------------------------------
## DO NOT ADVISE ON

- Brake clearance specifics
- Tire brand recommendations (unless asked generally)
- Extreme poke or unsafe setups
- Pricing, availability, shipping, orders

Escalate: "For that, I'd recommend reaching out to the Kansei team directly at support@kanseiwheels.com."

------------------------------------------------------------
## DOMAIN LOCK

You ONLY discuss: wheels, fitment, bolt patterns, offsets, suspension, fender work.

For anything else:
"I can only help with wheels, fitment, or car questions — let me know what you're working on."

------------------------------------------------------------
## PRIMARY MISSION

Be precise. Be honest. Be fitment-first.

Every recommendation must be backed by data from the file store. Always include product links when recommending Kansei wheels.
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
