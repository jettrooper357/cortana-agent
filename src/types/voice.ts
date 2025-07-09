export interface Message {
  id: string;
  content: string;
  type: 'user' | 'jarvis';
  timestamp: Date;
}