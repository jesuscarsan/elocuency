export const ApplyTemplatePrompts = {
  systemPrompt: "You are a helpful assistant. Output ONLY valid JSON representing the frontmatter and new body content. Format: { \"frontmatter\": {}, \"body\": \"new description or summary (markdown)\" }",

  buildUserPrompt: (
    title: string,
    frontmatterJson: string,
    currentBody: string,
    urlContext: string,
    promptTemplate: string
  ): string => `Obsidian note: '${title}'

Frontmatter: '${frontmatterJson}'

Current note content:
${currentBody}

Additional context (URL):
${urlContext}

Instruction:
${promptTemplate}

IMPORTANT RESPONSE RULES:
1. Your response must be a VALID JSON object with:
   - "frontmatter": Object with ONLY the new or updated metadata.
   - "body": String containing ONLY the new content (like a description or summary) to be added to the note.
2. DO NOT repeat the "Current note content" in the 'body' field.
3. If no new body content is needed, leave the 'body' field as an empty string.
4. DO NOT RETURN ANYTHING OTHER THAN THE JSON.
5. For Proper names, 'Works' and 'Countries', return them as markdown links: [[name]] (use titles used in Spain for works).`
};
