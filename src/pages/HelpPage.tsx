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
    title: "Bridge Mode (Other Cameras)",
    icon: Radio,
    category: "Vision",
    description: "Connect cameras from Ring, Nest, Arlo, or Zoom to your HGUARD screen.",
    howItWorks: "Open your other camera's website in a new tab. In HGUARD, turn on 'BRIDGE' and select that tab. HGUARD will then pull that video into your dashboard."
  },
  {
    id: "tactical-night-vision",
    title: "Night Vision",
    icon: Moon,
    category: "Vision",
    description: "Clear monitoring in the dark using smart light boosting.",
    howItWorks: "HGUARD automatically brightens dark images so you can see movement in pitch-black rooms. It also makes the AI work better in the dark."
  },
  {
    id: "elite-archive",
    title: "Video Library",
    icon: Video,
    category: "Storage",
    description: "Watch your recorded security videos anytime.",
    howItWorks: "All videos are saved safely to your Google Drive. You can watch them directly in the app without having to download anything."
  },
  {
    id: "gatekeeper",
    title: "Access Control",
    icon: Shield,
    category: "Security",
    description: "Control exactly who can see your cameras.",
    howItWorks: "When someone new joins, they stay 'Locked' until you approve them in the user settings. This keeps your home private and secure."
  },
  {
    id: "ai-zoom-enhance",
    title: "Smart Zoom",
    icon: Zap,
    category: "AI",
    description: "Keeps the picture sharp even when you zoom in deep.",
    howItWorks: "When you zoom in, HGUARD uses smart sharpening to make sure faces and objects stay as clear as possible instead of getting blurry."
  },
  {
    id: "noise-isolation",
    title: "Voice Focus",
    icon: Mic,
    category: "AI",
    description: "Cleans up background noise so you can hear people talking clearly.",
    howItWorks: "HGUARD filters out the 'hum' from fans or traffic and boosts the sound of human voices, making it easier to hear what's happening."
  },
  {
    id: "two-way-talk",
    title: "Walkie-Talkie",
    icon: Radio,
    category: "Security",
    description: "Talk to people through your cameras with one tap.",
    howItWorks: "Tap the microphone icon to start talking. Your voice goes straight to the camera. Tap again when you're done. It works just like a walkie-talkie."
  },
  {
    id: "drive-quota-control",
    title: "Storage Manager",
    icon: Info,
    category: "Storage",
    description: "Manage how much space your videos use on Google Drive.",
    howItWorks: "Tell HGUARD how much space you want to use. When the space is full, it automatically removes the oldest videos to make room for new ones."
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
