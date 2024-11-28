import axios, { AxiosInstance } from 'axios'
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

  private readonly orgUnitId = '14667939-6a1d-473a-8457-6a5f4de8c401'

  private client: AxiosInstance

  constructor () {
    this.baseUrl = config.apiBaseUrl

    this.client = axios.create({
      baseURL: this.baseUrl,
      // withCredentials: true,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }

  async sendMessage (messages: ChatMessage[]): Promise<ChatResponse> {
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

    const response = await this.client.post<ChatResponse>(
      '/api/chat',
      payload,
      {
        headers: {
          'org-unit-id': this.orgUnitId
        }
      }
    )

    return response.data
  }
}

export const chatService = new ChatService()
