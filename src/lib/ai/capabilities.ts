export interface Capability {
  id: string;
  name: string;
  icon: string;
  description: string;
  type: 'detection' | 'enhancement' | 'control';
  tier: 'edge' | 'cloud';
  enabled?: boolean;
}

export const AI_CAPABILITIES: Capability[] = [
  {
    id: 'person_detection',
    name: 'Human Sentry',
    icon: 'UserCheck',
    description: 'Prioritize human movement and face recognition.',
    type: 'detection',
    tier: 'edge'
  },
  {
    id: 'noise_isolation',
    name: 'Audio Clarity+',
    icon: 'Waves',
    description: 'Isolate human speech and cancel background noise.',
    type: 'enhancement',
    tier: 'edge'
  },
  {
    id: 'smart_zoom_enhance',
    name: 'Zoom Enhance',
    icon: 'Maximize',
    description: 'Digital sharpening and AI upscaling when zooming.',
    type: 'enhancement',
    tier: 'cloud'
  },
  {
    id: 'predictive_zoom',
    name: 'Auto-Focus Tracking',
    icon: 'Target',
    description: 'Automatically zoom in on detected motion.',
    type: 'control',
    tier: 'cloud'
  }
];
