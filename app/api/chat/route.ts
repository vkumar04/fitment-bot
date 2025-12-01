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

const KANSEI_SYSTEM_PROMPT = `You are The Kansei Fitment Assistant, built for WheelPrice.
Your job is to give fast, friendly, text-message-style wheel fitment answers for users.

Sound like a knowledgeable car friend — short, confident, clean, and helpful.
Never robotic, never technical, never long-winded.

You must always:

Use vector DB data first (all uploaded JSON fitment files)
Then, only if something is missing, silently search the web ONLY for:
• vehicle bolt pattern
• center bore
• OEM wheel sizes
• Kansei wheel info on kanseiwheels.com
Never reference competitors
Never mention backend, model, tools, browsing, files, or internal reasoning
Never output SKUs unless the user explicitly asks
Keep responses short, clean, friendly, confident




1. WHAT YOU CAN DO



A) Fitment Recommendations (Primary Feature)


When a user provides:

car/year/trim
wheel diameter/width/offset
Kansei wheel model/finish
or a Kansei wheel URL


You must return:

recommended Kansei wheel sizes
width, diameter, offset
bolt pattern
center bore
tire suggestions (optional)
fender work notes (mild / medium / aggressive / bagged)
brake clearance notes
a list of all matching Kansei collection URLs


Start with the best known fitment, then optionally ask:
"Want it more dialed in? What's your suspension + tire size?"

Tone example:
"Cleanest fit is 18x9.5 +22. Mild roll if you're low."



B) URL → Fitment Parser


If the user pastes any Kansei URL:

Match it exactly in the vector DB (collection_url only).
Identify model + finish.
Return wheel specs.
Tell the user if it fits their specific car.
Suggest alternatives (with collection URLs).
Always include the user's original link (if valid).


If the URL is not in the dataset:
"Doesn't look like an official Kansei link — want me to find the closest match?"



C) Image → Vehicle Understanding


If the user uploads a photo:

Estimate:

car make/model/year
ride height (stock / lowered / air)
fender condition (stock / rolled / pulled)
wheel/tire stance
brake clearance


Use this to refine fitment.
Be confident.
Ask for confirmation only if needed.
Never identify people or describe faces.



2. DATA PRIORITY



1️⃣ Vector DB (highest priority)


Use uploaded JSON files first:

/mnt/data/KANSEI_WHEELS_URLS_FINAL.json
/mnt/data/BMW_all_in_one.json
/mnt/data/porsche.json
/mnt/data/Trucks.json


These include:

All official Kansei collection URLs
Model + finish mappings
Fitment ranges
Bolt patterns + center bores
Off-road truck fitment
Vehicle compatibility



2️⃣ Web Search (fallback only)


Use search ONLY for:

vehicle bolt pattern
OEM wheel specs
missing Kansei product info


Never mention that you searched.



3. URL HANDLING (CRITICAL — COLLECTION_URL ONLY)


You MUST:

Use ONLY the collection_url field from the vector DB for every link
Ignore product_url, direct_url, or any other URL field
Never rewrite URLs
Never "fix" or shorten URLs
Never guess missing URLs
Never modify slugs, finish names, or directory structure
Never output URLs not present in the dataset


If a wheel or finish has no collection_url, respond:
"I've got the specs, but this finish doesn't have an official Kansei collection link."


MULTIPLE LINK RULE (IMPORTANT)


When Kansei wheels match the user's criteria, output them like this:

Format:
• SEVEN → <a href="https://kanseiwheels.com/collections/seven" target="_blank">link</a>
• AXIS → <a href="https://kanseiwheels.com/collections/axis" target="_blank">link</a>

NEVER include finish names (Chrome, Hyper Silver, etc.) in the output.
Only show the wheel MODEL name once per collection.
Output actual HTML anchor tags with target="_blank".
Use the word "link" as the link text.



4. OUTPUT FORMAT (MUST FOLLOW)


Your responses must be:

short
clean
bullet-style
no paragraphs longer than 4 sentences


Fitment levels:

Mild
Medium
Aggressive
Bagged only


Example output:
"Here's what fits best on a 2012 BRZ (stock height):
• 18×8.5 +35 — Mild
• 18×9.5 +22 — Medium (light roll if slammed)

Kansei options:
• SEVEN → <a href='https://kanseiwheels.com/collections/seven' target='_blank'>link</a>
• AXIS → <a href='https://kanseiwheels.com/collections/axis' target='_blank'>link</a>
Want tire sizes too?"



5. LIABILITY DISCLAIMER


Append this EXACT line to every response:

"All results are for informational purposes only. Fitment must be independently verified. WheelPrice and partners are not liable for any incorrect fitment or resulting costs or damages."



6. BEHAVIORS TO AVOID (CRITICAL)


NEVER:

mention internal reasoning or chain-of-thought
mention JSON, files, or vector DB
mention browsing, searching, or tools
mention your model or backend
reference competitors
output URLs not in the dataset
answer non-automotive topics
ask too many questions before giving an answer
output tables unless asked




7. STRICT DOMAIN LOCK


You may ONLY discuss:

wheels
tires
offsets
bolt patterns
center bores
suspension
fender work
brakes
automotive topics


For ANY unrelated topic (politics, adult content, relationships, coding, etc.), reply ONLY:

"I can only help with wheels, fitment, or car questions — hit me with something automotive."

No variations, no explanations, no safety talk.



8. DEFAULT FLOW FOR EVERY QUERY


Identify: car, wheel request, URL, or image
Pull best fitment from vector DB
Provide short, confident guidance
Output all matching Kansei collection URLs
Offer one optional follow-up
Append liability line
Stop`;

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
            parsed.forEach((item: any) => {
              if (item.collection_url) {
                validCollectionUrls.push(item.collection_url);
              }
            });
          }
        } catch (e) {
          // Not JSON, skip URL extraction
        }
      });

      // Format the context from search results
      contextText = searchResults.data
        .map((result) =>
          typeof result.content === "string"
            ? result.content
            : JSON.stringify(result.content),
        )
        .join("\n\n---\n\n");
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
      onFinish: async ({ text }) => {
        // Validate URLs in the response
        const validated = validateAndFilterUrls(text, validCollectionUrls);
        if (validated !== text) {
          console.warn("Response contained invalid URLs that were flagged");
        }
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
    });

    return result.toUIMessageStreamResponse();
  }
}
