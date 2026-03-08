import { Ollama } from 'ollama';
import { O } from 'ollama/dist/shared/ollama.1bfa89da';

export interface OllamaGenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export class OllamaClient {
  private readonly ollama: Ollama;

  private readonly OLLAMA_MODEL: string;
  private readonly OLLAMA_BASE_URL: string;

  constructor() {
    if (!process.env.OLLAMA_BASE_URL) {
      throw new Error('OLLAMA_BASE_URL environment variable is not set');
    }

    if (!process.env.OLLAMA_MODEL) {
      throw new Error('OLLAMA_MODEL environment variable is not set');
    }

    this.OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL;
    this.OLLAMA_MODEL = process.env.OLLAMA_MODEL;
    this.ollama = new Ollama({ host: this.OLLAMA_BASE_URL });
  }

  async generate(
    prompt: string,
    options?: OllamaGenerateOptions,
  ): Promise<string> {
    const response = await this.ollama.generate({
      model: options?.model ?? this.OLLAMA_MODEL,
      prompt,
      stream: false,
      options: {
        temperature: options?.temperature ?? 0.3,
        num_predict: options?.maxTokens ?? 512,
      },
    });
    return response.response.trim();
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.ollama.list();
      return true;
    } catch {
      return false;
    }
  }
}
