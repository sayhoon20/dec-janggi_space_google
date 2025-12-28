import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;

const getAIClient = () => {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return ai;
};

export const analyzeCodeWithGemini = async (
  code: string,
  filename: string,
  userPrompt: string
): Promise<string> => {
  try {
    const client = getAIClient();
    
    // We use gemini-3-pro-preview for coding tasks as recommended
    const modelId = "gemini-3-pro-preview";

    const systemInstruction = `You are an expert senior software engineer and code reviewer. 
    You are analyzing a file named "${filename}".
    Provide concise, actionable, and accurate insights. 
    If the user asks for an explanation, explain the logic clearly.
    If the user asks for bug detection, point out specific lines and potential fixes.
    Always format code snippets in Markdown.`;

    const prompt = `
    File Context: ${filename}
    
    Code Content:
    \`\`\`
    ${code.slice(0, 30000)} 
    \`\`\`
    (Note: Code may be truncated if too long)

    User Request: ${userPrompt}
    `;

    const response = await client.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        thinkingConfig: { thinkingBudget: 1024 } // Enable some reasoning for code analysis
      }
    });

    return response.text || "No response generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Failed to analyze code. Please check your API key and try again.";
  }
};

export const chatWithGemini = async (
  history: { role: string; text: string }[],
  newMessage: string
): Promise<string> => {
   try {
    const client = getAIClient();
    const modelId = "gemini-3-flash-preview"; // Faster model for general chat

    // Convert history to Gemini format (simplification for single turn or simple chat)
    // For a robust implementation, we would use ai.chats.create, but here we'll just send context + prompt for simplicity in this demo structure
    
    const contents = history.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
    }));
    
    // Add new message
    contents.push({
        role: 'user',
        parts: [{ text: newMessage }]
    });

    const response = await client.models.generateContent({
      model: modelId,
      contents: contents as any, 
    });

    return response.text || "I couldn't generate a response.";

   } catch (error) {
     console.error("Gemini Chat Error:", error);
     return "Error connecting to AI assistant.";
   }
}
