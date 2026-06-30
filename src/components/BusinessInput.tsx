import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Globe, ArrowRight, Loader2, Rocket, Calendar, Trash2, FolderOpen, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BusinessInputProps {
  onAnalyze: (url: string) => void;
  isLoading: boolean;
  savedReports?: any[];
  onLoadReport?: (id: string) => void;
  onDeleteReport?: (id: string) => void;
}

export function BusinessInput({ 
  onAnalyze, 
  isLoading
}: {
  onAnalyze: (url: string) => void;
  isLoading: boolean;
}) {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url) onAnalyze(url.startsWith('http') ? url : `https://${url}`);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] py-12 px-4 max-w-5xl mx-auto space-y-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl text-center space-y-8"
      >
        <div className="flex justify-center">
          <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 shadow-xs">
            <Rocket className="w-12 h-12 animate-bounce" />
          </div>
        </div>
        
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-sans">
            Activate Your Revenue Engine
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-lg mx-auto leading-relaxed">
            Submit your company URL to automatically construct your target ICP and uncover high-potential accounts.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
            <Globe className="w-5 h-5" />
          </div>
          <input
            type="text"
            placeholder="yourcompany.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full h-16 pl-12 pr-32 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-lg font-sans"
            disabled={isLoading}
          />
          <div className="absolute inset-y-2 right-2">
            <Button 
              type="submit" 
              className="h-full px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium cursor-pointer"
              disabled={isLoading || !url}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <div className="flex items-center gap-2">
                  Analyze <ArrowRight className="w-4 h-4" />
                </div>
              )}
            </Button>
          </div>
        </form>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 opacity-50 grayscale">
          <div className="flex items-center justify-center gap-2 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Live Search
          </div>
          <div className="flex items-center justify-center gap-2 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Evidence-Based
          </div>
          <div className="flex items-center justify-center gap-2 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> zero Hallucination
          </div>
          <div className="flex items-center justify-center gap-2 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> AI Sales Pilot
          </div>
        </div>
      </motion.div>
    </div>
  );
}
