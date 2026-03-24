'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, useLayoutEffect } from 'react';

export default function LandingPage() {
  const [showRules, setShowRules] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const rulesRef = useRef<HTMLButtonElement>(null);

  // Force scroll to top and disable restoration on mount
  useLayoutEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    // Sticky menu scroll listener
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Intersection Observer for auto-expanding rules
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        // Trigger only if intersecting AND the user has scrolled from the top
        if (entry.isIntersecting && window.scrollY > 50) {
          setShowRules(true);
        }
      },
      { 
        threshold: 1.0,
        rootMargin: '0px 0px -10% 0px'
      }
    );

    if (rulesRef.current) {
      observer.observe(rulesRef.current);
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rulesRef.current) observer.unobserve(rulesRef.current);
    };
  }, []);

  const rules = [
    {
      title: "The Mission",
      description: "You have 90 seconds to solve the poetic riddle. The Sukhan-wars (Poets) must collaborate, while the Naqal-baaz (Plagiarists) seek to sabotage.",
      icon: "📜"
    },
    {
      title: "The Majlis",
      description: "Gather in the assembly to debate and vote. Unmask the pretenders and banish them from the court before they silence the true poets.",
      icon: "⚖️"
    },
    {
      title: "The Night",
      description: "As darkness falls, the Zabaan-bandi begins. The plagiarists choose their target to silence, moving one step closer to absolute betrayal.",
      icon: "🌙"
    }
  ];

  return (
    <main className="min-h-screen bg-background text-white flex flex-col items-center selection:bg-gold selection:text-background overflow-x-hidden">
      {/* Sticky Menu / Header */}
      <nav className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 border-b border-gold/10 glass px-6 py-4 flex justify-between items-center ${isScrolled ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
        <div className="flex items-center gap-3">
          <span className="text-gold serif font-bold text-xl tracking-tight">Mehfil-e-Khaas</span>
        </div>
        <div className="flex gap-4">
          <Link href="/join" className="text-[10px] font-black uppercase tracking-widest text-gold/60 hover:text-gold border border-gold/20 hover:border-gold/50 px-4 py-2 rounded-full transition-all">Join</Link>
          <Link href="/host/setup" className="text-[10px] font-black uppercase tracking-widest bg-gold text-background px-4 py-2 rounded-full hover:scale-105 transition-all">Host</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-4xl w-full space-y-12 py-20 animate-fade-enter-active">
        <div className="space-y-4">
          <div className="flex items-center justify-center space-x-4 mb-4">
            <div className="h-[1px] w-12 bg-gold/30 hidden sm:block"></div>
            <span className="text-gold uppercase tracking-[0.5em] text-[10px] font-black">Est. 2026</span>
            <div className="h-[1px] w-12 bg-gold/30 hidden sm:block"></div>
          </div>
          
          <h1 className="text-7xl sm:text-9xl font-bold text-gold serif tracking-tight leading-none drop-shadow-2xl">
            Mehfil-e-Khaas
          </h1>
          <p className="text-xl sm:text-2xl text-gold/60 italic font-serif">
            "A Social Deduction Game of Poetry & Betrayal."
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6 w-full max-w-lg">
          <Link 
            href="/host/setup" 
            className="group relative w-full sm:w-1/2 overflow-hidden rounded-full p-[1px] transition-all hover:scale-[1.05] active:scale-[0.98]"
          >
            <div className="absolute inset-[-1000%] animate-[spin-slow_4s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#D4AF37_0%,#000_50%,#D4AF37_100%)]" />
            <div className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-background px-8 py-4 text-lg font-black uppercase tracking-widest text-gold transition-colors group-hover:bg-transparent group-hover:text-background">
              Create Room
            </div>
          </Link>

          <Link 
            href="/join" 
            className="w-full sm:w-1/2 rounded-full border border-gold/40 px-8 py-4 text-lg font-black uppercase tracking-widest text-gold/80 hover:bg-gold/10 hover:text-gold transition-all hover:scale-[1.05] active:scale-[0.98] text-center"
          >
            Join Game
          </Link>
        </div>

        {/* Scroll Indicator or CTA for Rules */}
        <button 
          ref={rulesRef}
          onClick={() => setShowRules(!showRules)}
          className="group flex flex-col items-center gap-2 text-gold/30 hover:text-gold/60 transition-colors uppercase text-[10px] font-black tracking-[0.3em] mt-12 bg-transparent outline-none border-none"
        >
          <span>The Nizaam (Rules)</span>
          <div className={`transition-all duration-700 ease-in-out ${showRules ? '-rotate-180 text-gold scale-125' : 'animate-bounce-slow'}`}>
            <svg 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className={showRules ? "drop-shadow-[0_0_8px_rgba(212,175,55,0.8)]" : ""}
            >
              <path d="M7 13l5 5 5-5M7 6l5 5 5-5"/>
            </svg>
          </div>
        </button>
      </section>

      {/* Rules Section (The Nizaam) */}
      <section className={`w-full max-w-6xl px-6 transition-all duration-700 ease-in-out ${showRules ? 'opacity-100 max-h-[2000px] mb-20' : 'opacity-0 max-h-0 overflow-hidden'}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {rules.map((rule, idx) => (
            <div 
              key={idx} 
              className="group glass p-8 rounded-4xl border border-gold/10 hover:border-gold/30 transition-all hover:translate-y-[-8px] duration-500"
            >
              <div className="text-4xl mb-6 bg-gold/10 w-16 h-16 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                {rule.icon}
              </div>
              <h3 className="text-2xl font-bold text-gold serif mb-4">{rule.title}</h3>
              <p className="text-gray-400 leading-relaxed font-light italic">
                {rule.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full p-8 border-t border-white/5 flex flex-col items-center justify-center space-y-4">
        <p className="text-white/20 text-[10px] uppercase font-black tracking-[0.4em] text-center">
          Bringing the magic of the Mushaira to the digital age.<br/>
          Built for the lovers of Sukhan and the soul of Hyderabadi gatherings.<br/>
          Built with ❤️ by Vikas Bandaru
        </p>
        <div className="flex gap-6 opacity-20 hover:opacity-100 transition-opacity">
          {/* Optional: Add social/github links here */}
          <div className="h-1 w-1 rounded-full bg-gold"></div>
          <div className="h-1 w-1 rounded-full bg-gold"></div>
          <div className="h-1 w-1 rounded-full bg-gold"></div>
        </div>
      </footer>

      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none opacity-20 -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-gold/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-gold/5 blur-[120px] rounded-full"></div>
      </div>
    </main>
  );
}
