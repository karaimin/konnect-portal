import axios from 'axios'
import { config } from '@/config'

export interface ChatMessage {
  content: string
  type: 'human' | 'ai'
  id?: string
  name?: string | null
  additional_kwargs?: Record<string, unknown>
  response_metadata?: Record<string, unknown>
  example?: boolean
}

interface ChatResponse {
  output: {
    messages: ChatMessage[]
  }
}

interface ChatRequest {
  config: {
    max_concurrency: number
  }
  input: {
    messages: ChatMessage[]
  }
}

export class ChatService {
  private baseUrl: string

  constructor() {
    this.baseUrl = config.apiBaseUrl
  }

  async sendMessage(messages: ChatMessage[]): Promise<ChatResponse> {
    const payload: ChatRequest = {
      config: {
        max_concurrency: 5
      },
      input: {
        messages: messages.map(msg => ({
          ...msg,
          type: msg.type
        }))
      }
    }

    const response = await axios.post<ChatResponse>(
      `${this.baseUrl}/api/chat`,
      payload
    )
    return response.data
  }
}

export const chatService = new ChatService()