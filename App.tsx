import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Phone, Users, BarChart3, Settings, Mic2, Bot, Trash2, Database, BrainCircuit, Lightbulb } from 'lucide-react';
import Dashboard from './components/Dashboard';
import LiveAgentDemo from './components/LiveAgentDemo';
import LeadManager from './components/LeadManager';
import { Lead, CallStatus, KnowledgeSnippet } from './types';

enum View {
  DASHBOARD = 'DASHBOARD',
  LEADS = 'LEADS',
  LIVE_DEMO = 'LIVE_DEMO',
  ANALYTICS = 'ANALYTICS',
  SETTINGS = 'SETTINGS'
}

// Scoring Algorithm
const calculateLeadScore = (lead: Partial<Lead>): number => {
  let score = 0;

  // 1. Base Score by Financial Potential (Price Range)
  switch (lead.priceRange) {
    case '$$$$': score += 40; break;
    case '$$$': score += 30; break;
    case '$$': score += 20; break;
    default: score += 10;
  }

  // 2. Status Weight
  switch (lead.status) {
    case CallStatus.BOOKED: score = 100; break; // Immediate Win
    case CallStatus.COMPLETED: score += 10; break; // Contact made
    case CallStatus.IN_PROGRESS: score += 20; break; // Currently active
    case CallStatus.PENDING: score += 0; break; // No contact yet
    case CallStatus.FAILED: score -= 20; break; // Bad number/etc
  }

  // 3. Sentiment Modifier
  if (lead.status !== CallStatus.BOOKED) {
    switch (lead.sentiment) {
      case 'Positive': score += 30; break; // Hot lead
      case 'Neutral': score += 5; break; // Warm
      case 'Negative': score -= 30; break; // Cold
    }
  }

  // Clamp 0-100
  return Math.max(0, Math.min(100, score));
};

// Generate 50 High-End Manhattan Restaurants
const generateManhattanLeads = (): Lead[] => {
  const restaurants = [
    { name: "Le Bernardin", contact: "Eric Ripert", cuisine: "French Seafood" },
    { name: "Per Se", contact: "Thomas Keller", cuisine: "French American" },
    { name: "Eleven Madison Park", contact: "Daniel Humm", cuisine: "Plant-based" },
    { name: "Carbone", contact: "Mario Carbone", cuisine: "Italian American" },
    { name: "Masa", contact: "Masa Takayama", cuisine: "Japanese Omakase" },
    { name: "Jean-Georges", contact: "Jean-Georges Vongerichten", cuisine: "French" },
    { name: "The Grill", contact: "Mario Carbone", cuisine: "American Chophouse" },
    { name: "Daniel", contact: "Daniel Boulud", cuisine: "French" },
    { name: "Le Coucou", contact: "Stephen Starr", cuisine: "French" },
    { name: "Atomix", contact: "Junghyun Park", cuisine: "Korean" },
    { name: "Cote", contact: "Simon Kim", cuisine: "Korean Steakhouse" },
    { name: "Balthazar", contact: "Keith McNally", cuisine: "French Brasserie" },
    { name: "Gramercy Tavern", contact: "Danny Meyer", cuisine: "American" },
    { name: "L'Artusi", contact: "August Cardona", cuisine: "Italian" },
    { name: "Manhatta", contact: "Danny Meyer", cuisine: "New American" }
  ];

  const leads: Lead[] = [];
  
  // Create top tier specific leads
  restaurants.forEach((r, i) => {
    const baseLead: Partial<Lead> = {
      id: `nyc-${i + 1}`,
      restaurantName: r.name,
      contactName: r.contact,
      phone: `+1 (212) 555-01${i.toString().padStart(2, '0')}`,
      status: i < 3 ? CallStatus.BOOKED : CallStatus.PENDING,
      cuisine: r.cuisine,
      location: "Manhattan, NY",
      priceRange: '$$$$',
      lastContacted: i < 3 ? 'Yesterday' : undefined,
      notes: "Top priority target. High average ticket size.",
      sentiment: i < 3 ? 'Positive' : undefined
    };
    
    // @ts-ignore - constructing full object
    leads.push({ ...baseLead, score: calculateLeadScore(baseLead) });
  });

  // Fill the rest to reach 50
  for (let i = 16; i <= 50; i++) {
    const baseLead: Partial<Lead> = {
      id: `nyc-${i}`,
      restaurantName: `Manhattan Bistro ${i}`,
      contactName: `Manager ${i}`,
      phone: `+1 (212) 555-02${i}`,
      status: CallStatus.PENDING,
      cuisine: "Fine Dining",
      location: "Manhattan, NY",
      priceRange: '$$$',
      notes: "Generated lead from scraping logic."
    };
    // @ts-ignore
    leads.push({ ...baseLead, score: calculateLeadScore(baseLead) });
  }
  
  return leads;
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeSnippet[]>([]);
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);

  // Load data from localStorage on mount
  useEffect(() => {
    const savedLeads = localStorage.getItem('hostai_leads');
    const savedKnowledge = localStorage.getItem('hostai_knowledge');
    
    if (savedLeads) {
      try {
        setLeads(JSON.parse(savedLeads));
      } catch (e) {
        console.error("Failed to parse saved leads", e);
        setLeads(generateManhattanLeads());
      }
    } else {
      setLeads(generateManhattanLeads());
    }

    if (savedKnowledge) {
      try {
        setKnowledgeBase(JSON.parse(savedKnowledge));
      } catch (e) {
        setKnowledgeBase([]);
      }
    }
  }, []);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    if (leads.length > 0) {
      localStorage.setItem('hostai_leads', JSON.stringify(leads));
    }
  }, [leads]);

  useEffect(() => {
    localStorage.setItem('hostai_knowledge', JSON.stringify(knowledgeBase));
  }, [knowledgeBase]);

  const handleStartCall = (leadId: string) => {
    setActiveLeadId(leadId);
    setCurrentView(View.LIVE_DEMO);
  };

  const handleUpdateLead = (updatedData: Lead) => {
    const scoredLead = {
      ...updatedData,
      score: calculateLeadScore(updatedData)
    };

    setLeads(prev => prev.map(l => l.id === scoredLead.id ? scoredLead : l));
  };

  const handleLearnFromCall = (snippet: KnowledgeSnippet) => {
    setKnowledgeBase(prev => [snippet, ...prev]);
  };

  const handleResetData = () => {
    if (window.confirm("Are you sure you want to reset all CRM data? This cannot be undone.")) {
      const newLeads = generateManhattanLeads();
      setLeads(newLeads);
      setKnowledgeBase([]);
      localStorage.setItem('hostai_leads', JSON.stringify(newLeads));
      localStorage.setItem('hostai_knowledge', JSON.stringify([]));
      alert("System reset complete.");
    }
  };

  const activeLead = leads.find(l => l.id === activeLeadId);

  // Settings Component Inline
  const SettingsView = () => (
    <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
      <h1 className="text-2xl font-bold text-slate-100 mb-6">Settings & RAG Management</h1>
      
      {/* Knowledge Base Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mb-6">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
              <BrainCircuit size={20} className="text-purple-400"/> Agent Knowledge Base (RAG)
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Strategies the AI has learned from successful calls to improve future outreach.
            </p>
          </div>
          <span className="bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full text-xs font-bold border border-purple-500/30">
            {knowledgeBase.length} Learned Patterns
          </span>
        </div>
        
        <div className="p-6">
          {knowledgeBase.length === 0 ? (
            <div className="text-center py-8 text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-950/30">
              <Lightbulb size={32} className="mx-auto mb-3 opacity-50" />
              <p>No knowledge extracted yet.</p>
              <p className="text-xs mt-1">Complete a successful call (Status: Booked) to train the agent.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {knowledgeBase.map((k) => (
                <div key={k.id} className="bg-slate-950/50 p-4 rounded-lg border border-slate-800 hover:border-purple-500/30 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      k.category === 'objection_handling' ? 'bg-red-500/10 text-red-400' : 
                      k.category === 'closing_technique' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'
                    }`}>
                      {k.category.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-slate-500">{k.timestamp}</span>
                  </div>
                  <p className="text-slate-300 text-sm italic">"{k.content}"</p>
                  <div className="mt-3 text-xs text-slate-500 flex items-center gap-1">
                    <Users size={10} /> Learned from {k.sourceRestaurant}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mb-6">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
            <Database size={20} className="text-indigo-400"/> System Data
          </h2>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-lg border border-slate-800">
            <div>
              <h3 className="text-sm font-medium text-slate-200">Reset System</h3>
              <p className="text-xs text-slate-500 mt-1">Clear all leads, transcripts, and learned RAG data.</p>
            </div>
            <button 
              onClick={handleResetData}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Trash2 size={16} /> Reset Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderView = () => {
    switch (currentView) {
      case View.DASHBOARD:
        return <Dashboard onViewChange={setCurrentView} />;
      case View.LIVE_DEMO:
        return (
          <LiveAgentDemo 
            activeLead={activeLead} 
            knowledgeBase={knowledgeBase}
            onUpdateLead={handleUpdateLead}
            onLearn={handleLearnFromCall}
            onBack={() => {
              setActiveLeadId(null);
              setCurrentView(View.LEADS);
            }}
          />
        );
      case View.LEADS:
        return <LeadManager leads={leads} onStartCall={handleStartCall} />;
      case View.SETTINGS:
        return <SettingsView />;
      default:
        return <Dashboard onViewChange={setCurrentView} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Mic2 size={20} className="text-white" />
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
            Host AI
          </span>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <SidebarItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={currentView === View.DASHBOARD} 
            onClick={() => setCurrentView(View.DASHBOARD)} 
          />
          <SidebarItem 
            icon={<Bot size={20} />} 
            label="Live Agent" 
            active={currentView === View.LIVE_DEMO} 
            onClick={() => setCurrentView(View.LIVE_DEMO)} 
            badge={activeLead ? "Active" : undefined}
          />
          <SidebarItem 
            icon={<Users size={20} />} 
            label="Lead Management" 
            active={currentView === View.LEADS} 
            onClick={() => setCurrentView(View.LEADS)} 
          />
          <SidebarItem 
            icon={<BarChart3 size={20} />} 
            label="Analytics" 
            active={currentView === View.ANALYTICS} 
            onClick={() => setCurrentView(View.ANALYTICS)} 
          />
          <SidebarItem 
            icon={<Settings size={20} />} 
            label="Settings & RAG" 
            active={currentView === View.SETTINGS} 
            onClick={() => setCurrentView(View.SETTINGS)} 
          />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500"></div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">Admin User</span>
              <span className="text-xs text-slate-500">Agency Owner</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 border-b border-slate-800 bg-slate-950/50 backdrop-blur flex items-center justify-between px-6 z-10">
          <div className="md:hidden font-bold text-lg">Host AI</div>
          <div className="flex items-center gap-4 ml-auto">
             <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20">
              <BrainCircuit size={14} className="text-purple-400" />
              <span className="text-xs font-medium text-purple-400">RAG Knowledge Base Active</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-xs font-medium text-green-500">System Operational</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6 scroll-smooth">
          {renderView()}
        </div>
      </main>
    </div>
  );
};

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: string;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon, label, active, onClick, badge }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 group ${
      active 
        ? 'bg-indigo-600/10 text-indigo-400' 
        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
    }`}
  >
    <div className="flex items-center gap-3">
      {icon}
      <span className="font-medium text-sm">{label}</span>
    </div>
    {badge && (
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500 text-white">
        {badge}
      </span>
    )}
  </button>
);

export default App;