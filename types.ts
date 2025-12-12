export enum CallStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  BOOKED = 'BOOKED'
}

export interface TranscriptEntry {
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export interface Lead {
  id: string;
  restaurantName: string;
  contactName: string;
  phone: string;
  status: CallStatus;
  cuisine: string;
  location: string;
  priceRange: '$$' | '$$$' | '$$$$';
  lastContacted?: string;
  notes?: string;
  sentiment?: 'Positive' | 'Neutral' | 'Negative';
  transcript?: TranscriptEntry[];
  score: number; // 0 to 100
  recording?: string; // Base64 Data URI of the call recording
}

export interface KnowledgeSnippet {
  id: string;
  category: 'objection_handling' | 'value_proposition' | 'closing_technique';
  content: string;
  sourceRestaurant: string;
  timestamp: string;
}

export interface Metric {
  label: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  icon: string;
}

// Audio Types for Gemini Live
export interface AudioQueueItem {
  buffer: AudioBuffer;
  duration: number;
}