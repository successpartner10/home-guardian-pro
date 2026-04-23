import { GeminiProvider } from "./providers/GeminiProvider";
import { GemmaProvider } from "./providers/GemmaProvider";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

export interface DetectedObject {
  label: string;
  confidence: number;
  box_2d?: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized 0-1000
  matched_reference?: boolean;
}

export interface AIResponse {
  label: string;
  confidence: number;
  tags: string[];
  summary?: string;
  risk_level: 'low' | 'medium' | 'high';
  detected_objects?: DetectedObject[];
}

export interface AIProvider {
  id: string;
  name: string;
  identify(imageData: string, modelOverride?: string, referenceImage?: string, isNightVision?: boolean): Promise<AIResponse>;
}

class AIOrchestrator {
  private providers: Map<string, AIProvider> = new Map();
  private currentProviderId: string = localStorage.getItem("hguard_ai_provider") || 'gemma';
  private modelManifest: Record<string, string> = {};

  constructor() {
    this.providers.set('gemini', new GeminiProvider());
    this.providers.set('gemma', new GemmaProvider());
    this.fetchManifest();
  }

  private async fetchManifest() {
    try {
      const docSnap = await getDoc(doc(db, "system", "ai_config"));
      if (docSnap.exists()) {
        this.modelManifest = docSnap.data().models || {};
        console.log("[AI] Adopted new model manifest from cloud:", this.modelManifest);
      }
    } catch (e) {
      console.warn("[AI] Failed to fetch manifest, using embedded defaults.");
    }
  }

  setProvider(id: string) {
    if (this.providers.has(id)) {
      this.currentProviderId = id;
      localStorage.setItem("hguard_ai_provider", id);
    }
  }

  setMode(mode: string) {
    // 'local' or 'cloud' mode handling can be added here
    console.log("[AI] Mode set:", mode);
  }

  getProviderId() {
    return this.currentProviderId;
  }

  async identify(imageData: string, referenceImage?: string): Promise<AIResponse> {
    const provider = this.providers.get(this.currentProviderId);
    if (!provider) throw new Error("No AI provider selected");

    const isNightVision = (window as any).hguard_night_vision || false;
    return provider.identify(imageData, undefined, referenceImage, isNightVision);
  }
}

export const aiOrchestrator = new AIOrchestrator();
