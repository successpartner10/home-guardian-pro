import { useState } from "react";
import { Brain, Zap, Sparkles, Target, Eye, Mic, Thermometer, ArrowRight, ShieldCheck, Microscope } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AIProposal {
  id: string;
  title: string;
  status: "available" | "research" | "future";
  icon: any;
  description: string;
  potential: string;
}

const proposals: AIProposal[] = [
  {
    id: "anomaly-detection",
    title: "Behavioral Anomaly Detection",
    status: "research",
    icon: Target,
    description: "AI learns 'normal' patterns (e.g., when you usually arrive home) and alerts only on deviations.",
    potential: "Reduces false alerts by 95% by ignoring routine movements."
  },
  {
    id: "facial-identity",
    title: "Edge Facial Recognition",
    status: "research",
    icon: Eye,
    description: "Distinguish between family members, known visitors, and strangers locally on your device.",
    potential: "Allows for 'Silent Alarms' where the siren only sounds for unknown intruders."
  },
  {
    id: "vocal-commands",
    title: "Natural Language Control",
    status: "future",
    icon: Mic,
    category: "Security",
    description: "Ask HGUARD questions like 'Is the front door open?' or 'When did the mail arrive?'.",
    potential: "Zero-touch surveillance management via voice."
  },
  {
    id: "thermal-vision",
    title: "AI Thermal Reconstruction",
    status: "future",
    icon: Thermometer,
    description: "Using AI to digitally map heat signatures from standard low-light IR sensors.",
    potential: "Detect fever or hidden human presence in pitch-black environments."
  },
  {
    id: "mesh-tracking",
    title: "Cross-Camera Object Tracking",
    status: "research",
    icon: Sparkles,
    description: "Automatically hand over tracking of a person from one camera to another as they move through your property.",
    potential: "Unified 'Follow' view that keeps the intruder in frame across all nodes."
  }
];

const AILab = () => {
  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto pb-32 space-y-12">
        {/* Header */}
        <div className="space-y-4 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-4 text-primary">
            <Microscope className="w-10 h-10" />
            <h1 className="text-4xl font-black uppercase tracking-tight leading-none">HGUARD <span className="text-white">AI LAB</span></h1>
          </div>
          <p className="text-lg text-muted-foreground font-medium">Future intelligence proposals and active AI research.</p>
        </div>

        <div className="p-6 rounded-[2.5rem] bg-primary border-2 border-primary shadow-[0_0_50px_rgba(var(--primary-rgb),0.3)] text-black">
          <div className="flex items-start gap-6">
            <Brain className="h-12 w-12 shrink-0" />
            <div className="space-y-2">
              <h2 className="text-2xl font-black uppercase tracking-tight">Intelligence Feed</h2>
              <p className="font-bold leading-tight opacity-80">
                As an AI Architect, I am constantly monitoring advances in Computer Vision and LLMs. 
                Below are features that can be integrated into HGUARD Elite as soon as hardware constraints allow.
              </p>
            </div>
          </div>
        </div>

        {/* Proposals Grid */}
        <div className="grid gap-6">
          {proposals.map((p, idx) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="group relative overflow-hidden p-8 rounded-[3rem] bg-white/[0.03] border-2 border-white/5 hover:border-primary/40 transition-all duration-500"
            >
              <div className="flex flex-col sm:flex-row gap-8 items-start">
                <div className="h-20 w-20 rounded-[2rem] bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-500 shrink-0">
                  <p.icon className="h-10 w-10" />
                </div>
                
                <div className="space-y-4 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-black uppercase tracking-tight">{p.title}</h3>
                    <span className={cn(
                      "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border",
                      p.status === "research" ? "bg-orange-500/20 border-orange-500/30 text-orange-400" : "bg-blue-500/20 border-blue-500/30 text-blue-400"
                    )}>
                      {p.status}
                    </span>
                  </div>
                  
                  <p className="text-lg text-white/60 font-medium leading-tight">
                    {p.description}
                  </p>
                  
                  <div className="pt-4 flex items-center gap-3 text-primary">
                    <Zap className="h-4 w-4" />
                    <span className="text-xs font-black uppercase tracking-widest">Potential Impact: {p.potential}</span>
                  </div>
                </div>
              </div>

              <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-12 w-12 rounded-full bg-primary/10 text-primary">
                  <ArrowRight className="h-6 w-6" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="text-center pt-12">
          <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em]">System Intelligence v2.5.5 • Experimental Build</p>
        </div>
      </div>
    </AppLayout>
  );
};

export default AILab;
