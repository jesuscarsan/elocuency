export enum ChatCategory {
  AskObsidian = 'ask_obsidian',
  ModifyObsidian = 'modify_obsidian',
  WebSearch = 'web_search',
  ExecuteAction = 'execute_action',
  GeneralChat = 'general_chat',
}

export interface ChatIntent {
  intent: ChatCategory;
  extracted_context: string;
}
