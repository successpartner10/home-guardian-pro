import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Book, Zap, Shield, Video, Moon, Radio, Share2, HelpCircle, ChevronRight, Info, Mic } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface FeatureHelp {
  id: string;
  title: string;
  icon: any;
  category: "Vision" | "Security" | "Storage" | "AI";
  description: string;
  howItWorks: string;
}

const features: FeatureHelp[] = [
  {
    id: "bridge-mode",
    title: "Bridge Mode (Screen Share)",
    icon: Radio,
    category: "Vision",
    description: "Import video feeds from locked brands like Ring, Nest, Arlo, or Zoom into your HGUARD mesh.",
    howItWorks: "Open your camera's web dashboard in a separate browser tab. In HGUARD Camera Mode, toggle 'BRIDGE' and select that tab. HGUARD will capture the feed and broadcast it as a native camera node."
  },
  {
    id: "tactical-night-vision",
    title: "Tactical Night Vision",
    icon: Moon,
    category: "Vision",
    description: "High-contrast low-light monitoring with AI sensitivity boosting.",
    howItWorks: "HGUARD analyzes ambient brightness. When light drops below 20%, it applies digital contrast/brightness normalization and signals the AI to switch to 'High Sensitivity' mode for IR footage."
  },
  {
    id: "elite-archive",
    title: "Elite Archive",
    icon: Video,
    category: "Storage",
    description: "In-app repository for all recorded security events.",
    howItWorks: "Clips are saved to your private Google Drive. The Archive page lists these files and allows you to stream them directly via blob URLs without leaving the app."
  },
  {
    id: "gatekeeper",
    title: "Gatekeeper (Admin Approval)",
    icon: Shield,
    category: "Security",
    description: "Control who can access your HGUARD platform.",
    howItWorks: "New users are placed in a 'Pending' state upon sign-up. The primary Admin (successpartner10) must toggle their status to 'Approved' in the Settings > User Management panel."
  },
  {
    id: "ai-zoom-enhance",
    title: "AI Zoom Enhance",
    icon: Zap,
    category: "AI",
    description: "Digital sharpening and contrast boosting during high-magnification zoom.",
    howItWorks: "As you zoom in on a live feed, HGUARD applies real-time CSS 'crisp-edges' rendering and adjusts local contrast to maintain detail in distant objects."
  },
  {
    id: "noise-isolation",
    title: "Audio Clarity+ (Noise Isolation)",
    icon: Mic,
    category: "AI",
    description: "Filters out background hum and focuses on human speech during live monitoring.",
    howItWorks: "HGUARD uses a real-time BiquadFilter on the browser audio context to suppress frequencies below 150Hz and above 3000Hz, effectively isolating the vocal range."
  },
  {
    id: "two-way-talk",
    title: "Instant Talk (Toggle Mode)",
    icon: Radio,
    category: "Security",
    description: "Professional hands-free communication with your camera nodes.",
    howItWorks: "The 'Talk' button is a toggle. Tap once to open the audio uplink. HGUARD establishes a secondary WebRTC audio track to the camera. Tap again to close the mic."
  },
  {
    id: "drive-quota-control",
    title: "Drive Quota Control",
    icon: Info,
    category: "Storage",
    description: "Manage your cloud storage buffer to prevent overages.",
    howItWorks: "Set a GB limit in Settings. Every time a new clip is recorded, HGUARD checks the total folder size. If it exceeds your limit, the oldest clips are automatically purged (FIFO)."
  }
];

const HelpPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFeature, setSelectedFeature] = useState<FeatureHelp | null>(null);

  const filteredFeatures = features.filter(f => 
    f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto pb-32 space-y-12">
        {/* Header */}
        <div className="space-y-4 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-4 text-primary">
            <HelpCircle className="w-10 h-10" />
            <h1 className="text-4xl font-black uppercase tracking-tight">HGUARD Academy</h1>
          </div>
          <p className="text-lg text-muted-foreground font-medium">Master the elite surveillance ecosystem.</p>
        </div>

        {/* Search Bar */}
        <div className="relative group">
          <div className="absolute inset-0 bg-primary/10 blur-2xl group-focus-within:bg-primary/20 transition-all rounded-full" />
          <div className="relative flex items-center">
            <Search className="absolute left-6 h-5 w-5 text-white/40 group-focus-within:text-primary transition-colors" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search features (e.g., 'Bridge', 'Night Vision')..."
              className="h-16 pl-16 pr-8 bg-black/40 border-2 border-white/5 rounded-[2rem] text-lg font-bold placeholder:text-white/20 focus:border-primary/50 focus:ring-0 transition-all"
            />
          </div>
        </div>

        {/* Feature List */}
        <div className="grid gap-4">
          <AnimatePresence mode="popLayout">
            {filteredFeatures.map((f) => (
              <motion.div
                key={f.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <div 
                  onClick={() => setSelectedFeature(selectedFeature?.id === f.id ? null : f)}
                  className={cn(
                    "group relative overflow-hidden rounded-[2.5rem] border-2 transition-all cursor-pointer p-6",
                    selectedFeature?.id === f.id 
                      ? "bg-primary border-primary shadow-[0_0_40px_rgba(var(--primary-rgb),0.2)]" 
                      : "bg-white/[0.03] border-white/5 hover:border-white/20"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className={cn(
                        "h-14 w-14 rounded-2xl flex items-center justify-center transition-colors",
                        selectedFeature?.id === f.id ? "bg-black text-primary" : "bg-primary/10 text-primary"
                      )}>
                        <f.icon className="h-7 w-7" />
                      </div>
                      <div className="space-y-1">
                        <p className={cn(
                          "text-xl font-black uppercase tracking-tight",
                          selectedFeature?.id === f.id ? "text-black" : "text-white"
                        )}>
                          {f.title}
                        </p>
                        <p className={cn(
                          "text-xs font-bold uppercase tracking-widest",
                          selectedFeature?.id === f.id ? "text-black/60" : "text-muted-foreground"
                        )}>
                          {f.category}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className={cn(
                      "h-6 w-6 transition-transform",
                      selectedFeature?.id === f.id ? "rotate-90 text-black" : "text-white/20"
                    )} />
                  </div>

                  <AnimatePresence>
                    {selectedFeature?.id === f.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-8 space-y-6">
                          <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-black/40">What it does</p>
                            <p className="text-lg font-bold text-black leading-tight">{f.description}</p>
                          </div>
                          <div className="p-5 rounded-3xl bg-black/10 border border-black/5 space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-black/40">How it works</p>
                            <p className="text-sm font-medium text-black/80 leading-relaxed italic">
                              "{f.howItWorks}"
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Empty State */}
        {filteredFeatures.length === 0 && (
          <div className="text-center py-20 space-y-4 opacity-30">
            <Info className="h-12 w-12 mx-auto" />
            <p className="text-xl font-black uppercase">No results found for "{searchQuery}"</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default HelpPage;
