import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import { BASE_PROMPT, getSystemPrompt } from "./prompts.js";
import express from "express";
import type { TextBlock } from "@anthropic-ai/sdk/resources";
import { basePrompt as reactBasePrompt } from "./defaults/react.js";
import { basePrompt as nodeBasePrompt } from "./defaults/node.js";

dotenv.config();
const anthropic = new Anthropic();
const PORT = 8000;

const app = express();
app.use(express.json());

//with the user prompt, 3 other prompts will be sent to llm
app.post("/template", async (req, res) => {
  //getting the prompt from the user
  const prompt = req.body.prompt;

  try {
    //1st trying to get the context of the project (react/node) and based upon the type the base prompt will be selected
    const response = await anthropic.messages.create({
      messages: [
        {
          role: "user",
          content: `Classify this as either a "node" or "react" project: ${prompt}`,
        },
      ],
      model: "claude-opus-4-1-20250805",
      max_tokens: 5,
      system:
        "You must respond with ONLY the word 'node' or 'react'. Do not provide any other text, explanations, or code. Analyze the user's request and determine if they want a Node.js backend project (respond 'node') or a React frontend project (respond 'react').",
    });

    const answer = (response.content[0] as TextBlock).text; // react or node
    // if (answer) {
    //   res.status(200).json({ message: `${answer}` });
    //   return;
    // }

    if (answer === "react") {
      res.json({
        prompts: [
          BASE_PROMPT,
          `Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${reactBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n`,
        ],
        uiPrompts: [reactBasePrompt], //prompt to show files on frontend
      });
      return;
    }

    if (answer === "node") {
      res.json({
        prompts: [
          `Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${nodeBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n`,
        ],
        uiPrompts: [nodeBasePrompt],
      });
      return;
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// async function main() { //using sse (server sent events) for streaming the msgs
//   anthropic.messages
//     .stream({
//       messages: [{ role: "user", content: "Hello" }],
//       model: "claude-opus-4-1-20250805",
//       max_tokens: 500,
//     })
//     .on("text", (text) => {
//       console.log(text);
//     });
// }

app.post("/chat", async (req, res) => {
  const messages = req.body.messages;
  try {
    const response = await anthropic.messages.create({
      messages: messages,
      model: "claude-opus-4-1-20250805",
      max_tokens: 8000,
      system: getSystemPrompt(),
    });

    console.log(response);

    res.json({
      response: (response.content[0] as TextBlock)?.text,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`App is listening on PORT ${PORT}`);
});
