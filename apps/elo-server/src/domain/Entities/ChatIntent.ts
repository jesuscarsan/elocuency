export enum ChatCategory {
  AskMemory = 'ask_memory',
  ModifyMemory = 'modify_memory',
  WebSearch = 'web_search',
  ExecuteAction = 'execute_action',
  GeneralChat = 'general_chat',
  CreateNote = 'create_note',
}

export interface ChatIntent {
  intent: ChatCategory;
  extracted_context: string;
}
