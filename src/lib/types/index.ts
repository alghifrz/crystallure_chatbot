// Types untuk RAG system
export interface ProductInfo {
  name: string;
  description?: string;
  volume?: string;
  weight?: string;
  price?: string;
  ingredients?: string[];
  benefits?: string[];
  usage?: string;
  targetMarket?: string;
  skinType?: string;
}

export interface ChunkMetadata {
  product: string;
  section: string;
  chunk_text: string;
  [key: string]: any;
}

export interface SearchMatch {
  id: string;
  score: number;
  metadata: ChunkMetadata;
}

export interface SearchResult {
  matches: SearchMatch[];
  totalMatches: number;
  searchStrategy: 'product_based' | 'content_based';
  fetchLimit: number;
}

export interface QuestionAnalysis {
  isGeneralQuestion: boolean;
  isSpecificSearch: boolean;
  isIngredientQuestion: boolean;
  hasCrystallure: boolean;
  searchStrategy: 'product_based' | 'content_based';
  fetchLimit: number;
}

export interface AnswerResult {
  answer: string;
  productDetected: string | null;
  totalMatches: number;
  sources?: SearchMatch[];
}

export interface ConversationContext {
  currentProduct?: string;
  previousQuestions?: string[];
  contextHistory?: string;
}
