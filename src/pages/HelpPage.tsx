import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Zap, Shield, Video, Moon, Radio, HelpCircle, ChevronRight, Info, Mic, Thermometer, Sparkles, AlertOctagon, BrainCircuit, Star } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ThermalLab } from "@/components/ailab/ThermalLab";
import { MeshTrackingLab } from "@/components/ailab/MeshTrackingLab";
import { FeatureIllustration } from "@/components/help/FeatureIllustration";

interface FeatureHelp {
  id: string;
  title: string;
  icon: any;
  category: "Vision" | "Security" | "Storage" | "AI";
  description: string;
  howItWorks: string;
  recommended?: boolean;
  recommendedReason?: string;
  actionLabel: string;
  actionRoute?: string;
  actionLab?: "thermal" | "mesh";
}

const features: FeatureHelp[] = [
  {
    id: "tactical-night-vision",
    title: "Night Vision Boosting",
    icon: Moon,
    category: "Vision",
    recommended: true,
    recommendedReason: "Most cameras are in low-light areas — this helps see clearly at night.",
    description: "Provides clear, bright monitoring in dark spaces using digital light amplification.",
    howItWorks: "HGUARD automatically brightens dim frames, making it easier for you and the AI to spot unexpected activity in dark rooms.",
    actionLabel: "Open Night Vision Filter",
    actionRoute: "/dashboard",
  },
  {
    id: "thermal-vision",
    title: "AI Thermal Reconstruction",
    icon: Thermometer,
    category: "AI",
    recommended: true,
    recommendedReason: "Use this with night vision to detect hidden human presence by body heat alone.",
    description: "Reconstructs thermal maps from standard low-light cameras so you can check heat signatures in pitch-black environments.",
    howItWorks: "HGUARD analyzes night vision feeds through a smart neural processor that estimates surface heat and highlights human body presence.",
    actionLabel: "Launch Thermal Vision Mapper",
    actionLab: "thermal",
  },
  {
    id: "two-way-talk",
    title: "One-Tap Walkie-Talkie",
    icon: Radio,
    category: "Security",
    recommended: true,
    recommendedReason: "Tap the mic icon on any live feed to instantly speak through that camera.",
    description: "Speak directly through your cameras to anyone in your home.",
    howItWorks: "Tap the microphone icon to talk. Your voice plays instantly through the camera. Tap again to stop. Simple and fast.",
    actionLabel: "Open Live Talkback",
    actionRoute: "/dashboard",
  },
  {
    id: "mesh-tracking",
    title: "Cross-Camera Object Tracking",
    icon: Sparkles,
    category: "AI",
    description: "Tracks movement across your yard by automatically handing off video between adjacent cameras.",
    howItWorks: "As a visitor crosses from one camera's view into another, HGUARD seamlessly lock-negotiates, keeping them focused in a single live feed.",
    actionLabel: "Launch Mesh Tracking Lab",
    actionLab: "mesh",
  },
  {
    id: "ai-threat-guard",
    title: "Predictive AI Threat Guard",
    icon: BrainCircuit,
    category: "AI",
    description: "Calculates real-time danger indexes by evaluating lingering, pathing vectors, and proximity on the edge.",
    howItWorks: "Differentiates friendly visitors (like postal couriers on clear paths) from slow-lingering actors, instantly alerting you when the risk score rises.",
    actionLabel: "Open AI Threat Parameters",
    actionRoute: "/settings",
  },
  {
    id: "siren-defense",
    title: "Autonomous Security Siren",
    icon: AlertOctagon,
    category: "Security",
    description: "Sound high-decibel audible sirens and trigger strobe flashing when a persistent threat is verified.",
    howItWorks: "If the AI Threat Guard locks on a suspicious target lingering in hazard zones, it triggers dual acoustic deterrence automatically.",
    actionLabel: "Open Siren Rule Settings",
    actionRoute: "/settings",
  },
  {
    id: "bridge-mode",
    title: "Screen Share (Other Cameras)",
    icon: Radio,
    category: "Vision",
    description: "Show video from Ring, Nest, Arlo, or a browser tab right on your HGUARD dashboard.",
    howItWorks: "Open your other camera in a browser tab. On your HGUARD camera device, select Screen Share and choose that tab. The viewer mirrors it instantly.",
    actionLabel: "Open Screen Cast Panel",
    actionRoute: "/dashboard",
  },
  {
    id: "elite-archive",
    title: "Cloud Recordings",
    icon: Video,
    category: "Storage",
    description: "Saves and stores security clips securely so you can watch them anytime.",
    howItWorks: "Recorded clips are automatically saved to your Google Drive folder, allowing direct playback in the app without downloading.",
    actionLabel: "Open Recording Archive",
    actionRoute: "/archive",
  },
  {
    id: "gatekeeper",
    title: "Viewer Access Control",
    icon: Shield,
    category: "Security",
    description: "Gives you complete control over who is allowed to monitor your camera feeds.",
    howItWorks: "New monitoring devices stay locked on standby until you manually approve them in your administrator settings.",
    actionLabel: "Open Device & Security Manager",
    actionRoute: "/settings",
  },
  {
    id: "ai-zoom-enhance",
    title: "Smart Zoom Details",
    icon: Zap,
    category: "AI",
    description: "Keeps your picture clear and sharp even when you zoom in close.",
    howItWorks: "HGUARD automatically sharpens facial features and object outlines when you zoom, reducing pixel blockiness.",
    actionLabel: "Open Live Stream Booster",
    actionRoute: "/dashboard",
  },
  {
    id: "noise-isolation",
    title: "Voice Noise Filter",
    icon: Mic,
    category: "AI",
    description: "Cleans up loud backgrounds so you can hear people talking clearly.",
    howItWorks: "Filters out environmental static hums (like fans, wind, or traffic) while boosting natural human vocal frequencies.",
    actionLabel: "Configure Microphone Filters",
    actionRoute: "/settings",
  },
  {
    id: "drive-quota-control",
    title: "Automatic Storage Cleanups",
    icon: Info,
    category: "Storage",
    description: "Keeps your Google Drive organized and prevents storage limits from filling up.",
    howItWorks: "Choose your maximum storage space. When full, HGUARD automatically recycles your oldest recordings to make room for new ones.",
    actionLabel: "Open Storage Quota Settings",
    actionRoute: "/settings",
  },
];

const HelpPage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thermalOpen, setThermalOpen] = useState(false);
  const [meshOpen, setMeshOpen] = useState(false);

  const filtered = features.filter(f =>
    f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const recommended = filtered.filter(f => f.recommended);
  const rest = filtered.filter(f => !f.recommended);

  const handleAction = (f: FeatureHelp, e: React.MouseEvent) => {
    e.stopPropagation();
    if (f.actionLab === "thermal") setThermalOpen(true);
    else if (f.actionLab === "mesh") setMeshOpen(true);
    else if (f.actionRoute) navigate(f.actionRoute);
  };

  const FeatureCard = ({ f }: { f: FeatureHelp }) => {
    const open = selectedId === f.id;
    return (
      <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}>
        <div
          onClick={() => setSelectedId(open ? null : f.id)}
          className={cn(
            "w-full rounded-[2rem] border-2 transition-all cursor-pointer overflow-hidden",
            open
              ? "bg-primary border-primary shadow-[0_0_30px_rgba(var(--primary-rgb),0.15)]"
              : "bg-white/[0.03] border-white/5 hover:border-white/15"
          )}
        >
          {/* Header row */}
          <div className="flex items-center justify-between p-4 sm:p-5">
            <div className="flex items-center gap-4">
              <div className={cn(
                "h-11 w-11 shrink-0 rounded-[1rem] flex items-center justify-center",
                open ? "bg-black text-primary" : "bg-primary/10 text-primary"
              )}>
                <f.icon className="h-5 w-5" />
              </div>
              <div>
                <p className={cn("text-[15px] font-bold leading-tight", open ? "text-black" : "text-white")}>
                  {f.title}
                </p>
                <p className={cn("text-[10px] font-semibold capitalize mt-0.5", open ? "text-black/50" : "text-muted-foreground")}>
                  {f.category} Feature
                </p>
              </div>
            </div>
            <ChevronRight className={cn("h-4 w-4 shrink-0 transition-transform", open ? "rotate-90 text-black/50" : "text-white/20")} />
          </div>

          {/* Expanded content */}
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-4 sm:px-5 pb-5 space-y-4" onClick={e => e.stopPropagation()}>
                  <p className="text-sm font-semibold text-black/80 leading-snug">{f.description}</p>

                  {/* Live illustration */}
                  <div>
                    <p className="text-[9px] font-bold text-black/40 uppercase tracking-wider mb-1">Live Illustration</p>
                    <FeatureIllustration featureId={f.id} />
                  </div>

                  {/* Action button */}
                  <Button
                    onClick={(e) => handleAction(f, e)}
                    className="w-full h-10 bg-black text-white hover:bg-zinc-900 rounded-[1rem] font-bold text-[10px] uppercase tracking-wider"
                  >
                    ⚡ {f.actionLabel}
                  </Button>

                  {/* How it works */}
                  <div className="p-3.5 rounded-2xl bg-black/10 border border-black/5">
                    <p className="text-[9px] font-bold text-black/40 uppercase tracking-wider mb-1">How it works</p>
                    <p className="text-xs text-black/70 leading-relaxed italic">"{f.howItWorks}"</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  };

  return (
    <AppLayout>
      <div className="px-4 sm:px-6 max-w-2xl mx-auto pb-32 space-y-8 pt-6">
        {/* Header */}
        <div className="flex items-center gap-3 text-primary">
          <HelpCircle className="w-7 h-7 shrink-0" />
          <div>
            <h1 className="text-2xl font-black tracking-tight leading-none">Help & Tips</h1>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">Blueprint simulations for every feature.</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search guides…"
            className="h-12 pl-11 bg-white/[0.04] border border-white/8 rounded-2xl text-sm font-medium placeholder:text-white/20 focus:border-primary/40 focus:ring-0"
          />
        </div>

        {/* Recommended section */}
        {!searchQuery && recommended.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Star className="h-3.5 w-3.5 text-primary fill-primary" />
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Recommended for you</p>
            </div>
            <div className="p-3 rounded-[1.5rem] bg-primary/5 border border-primary/10 space-y-2">
              {recommended.map(f => (
                <button
                  key={f.id}
                  onClick={() => setSelectedId(f.id)}
                  className="w-full text-left flex items-start gap-3 p-2 rounded-xl hover:bg-primary/10 transition-colors"
                >
                  <f.icon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-white">{f.title}</p>
                    <p className="text-[10px] text-white/50 leading-snug mt-0.5">{f.recommendedReason}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* All features */}
        <div className="space-y-3">
          {!searchQuery && <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">All Features</p>}
          <AnimatePresence mode="popLayout">
            {(searchQuery ? filtered : [...recommended, ...rest]).map(f => (
              <FeatureCard key={f.id} f={f} />
            ))}
          </AnimatePresence>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 opacity-25 space-y-2">
            <Info className="h-8 w-8 mx-auto" />
            <p className="text-sm font-bold">No results for "{searchQuery}"</p>
          </div>
        )}
      </div>

      <ThermalLab open={thermalOpen} onOpenChange={setThermalOpen} />
      <MeshTrackingLab open={meshOpen} onOpenChange={setMeshOpen} />
    </AppLayout>
  );
};

export default HelpPage;
