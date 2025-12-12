import React, { useState } from 'react';
import { Search, Filter, MoreHorizontal, Phone, Mail, Calendar, MapPin, DollarSign, TrendingUp, PlayCircle } from 'lucide-react';
import { CallStatus, Lead } from '../types';

interface LeadManagerProps {
  leads: Lead[];
  onStartCall: (id: string) => void;
}

const LeadManager: React.FC<LeadManagerProps> = ({ leads, onStartCall }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'score' | 'name'>('score');
  
  // Audio Playback State
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);

  const toggleAudio = (id: string, src: string) => {
    if (playingId === id && audioEl) {
        audioEl.pause();
        setPlayingId(null);
    } else {
        if (audioEl) audioEl.pause();
        const newAudio = new Audio(src);
        newAudio.play();
        newAudio.onended = () => setPlayingId(null);
        setAudioEl(newAudio);
        setPlayingId(id);
    }
  };

  const getStatusColor = (status: CallStatus) => {
    switch (status) {
      case CallStatus.BOOKED: return 'bg-green-500/10 text-green-400 border-green-500/20';
      case CallStatus.COMPLETED: return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case CallStatus.IN_PROGRESS: return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case CallStatus.FAILED: return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const filteredLeads = leads
    .filter(lead => 
      lead.restaurantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.contactName.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'score') return b.score - a.score;
      return a.restaurantName.localeCompare(b.restaurantName);
    });

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Manhattan Outreach</h1>
          <p className="text-slate-400 text-sm mt-1">Targeting {leads.length} high-end venues. Prioritized by Lead Score.</p>
        </div>
        <div className="flex gap-2">
           <button 
            onClick={() => setSortBy(prev => prev === 'score' ? 'name' : 'score')}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg border border-slate-700 transition-colors flex items-center gap-2"
           >
            <TrendingUp size={16} className={sortBy === 'score' ? 'text-indigo-400' : 'text-slate-400'} />
            Sort: {sortBy === 'score' ? 'High Value' : 'Name'}
          </button>
          <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-indigo-900/20">
            Import CSV
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-[calc(100vh-200px)]">
        <div className="p-4 border-b border-slate-800 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="Search leads..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950 text-slate-400 font-medium sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 border-b border-slate-800 bg-slate-950 w-64">Restaurant</th>
                <th className="px-6 py-3 border-b border-slate-800 bg-slate-950">Lead Score</th>
                <th className="px-6 py-3 border-b border-slate-800 bg-slate-950">Details</th>
                <th className="px-6 py-3 border-b border-slate-800 bg-slate-950">Status</th>
                <th className="px-6 py-3 border-b border-slate-800 bg-slate-950">Contact</th>
                <th className="px-6 py-3 border-b border-slate-800 bg-slate-950 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-800/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-200 text-base">{lead.restaurantName}</div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                       <MapPin size={12} /> {lead.location}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5 w-32">
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-200">{lead.score}</span>
                            <span className="text-slate-500">/ 100</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div 
                                className={`h-full rounded-full ${getScoreColor(lead.score)}`} 
                                style={{ width: `${lead.score}%` }}
                            ></div>
                        </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-slate-300">{lead.cuisine}</div>
                    <div className="text-xs text-slate-500 flex items-center">
                        <span className="text-indigo-400 mr-2">{lead.priceRange}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(lead.status)}`}>
                      {lead.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                      <div className="text-slate-300">{lead.contactName}</div>
                      <div className="text-xs text-slate-500">{lead.phone}</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                        {lead.recording && (
                           <button 
                             onClick={() => toggleAudio(lead.id, lead.recording!)}
                             className={`p-1.5 rounded transition-colors ${playingId === lead.id ? 'text-green-400 bg-green-500/10' : 'text-slate-400 hover:text-indigo-400 hover:bg-slate-700'}`}
                             title="Play Recording"
                           >
                             <PlayCircle size={16} />
                           </button>
                        )}
                        {lead.status === CallStatus.PENDING || lead.status === CallStatus.IN_PROGRESS ? (
                             <button 
                                onClick={() => onStartCall(lead.id)}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-medium flex items-center gap-1 transition-colors"
                             >
                                <Phone size={12} /> Call Agent
                             </button>
                        ) : (
                            <button className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white" title="View Transcript">
                                <MoreHorizontal size={16} />
                            </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LeadManager;