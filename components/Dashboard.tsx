import React from 'react';
import { ArrowUpRight, ArrowDownRight, Phone, CalendarCheck, Users, DollarSign, Clock, Zap, Target, Activity, Timer } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { Metric } from '../types';

interface DashboardProps {
  onViewChange: (view: any) => void;
}

const outreachData = [
  { name: 'Mon', calls: 40, booked: 2 },
  { name: 'Tue', calls: 30, booked: 1 },
  { name: 'Wed', calls: 50, booked: 4 },
  { name: 'Thu', calls: 75, booked: 8 },
  { name: 'Fri', calls: 60, booked: 5 },
  { name: 'Sat', calls: 45, booked: 3 },
  { name: 'Sun', calls: 20, booked: 1 },
];

const latencyData = [
  { time: 'Day 1', ms: 520 },
  { time: 'Day 2', ms: 480 },
  { time: 'Day 3', ms: 410 },
  { time: 'Day 4', ms: 350 },
  { time: 'Day 5', ms: 310 },
  { time: 'Day 6', ms: 290 },
  { time: 'Day 7', ms: 275 }, // "Lightning fast" trend
];

const durationDistribution = [
  { range: '< 30s', count: 45 },
  { range: '30s-1m', count: 120 },
  { range: '1m-2m', count: 210 },
  { range: '2m-4m', count: 180 },
  { range: '> 4m', count: 65 },
];

const metrics: Metric[] = [
  { label: 'Total Calls Made', value: '1,284', change: '+12.5%', trend: 'up', icon: 'phone' },
  { label: 'Success Rate', value: '11.2%', change: '+2.4%', trend: 'up', icon: 'target' },
  { label: 'Avg. Response Time', value: '275ms', change: '15% faster', trend: 'up', icon: 'zap' },
  { label: 'Avg. Call Duration', value: '2m 14s', change: '+34s', trend: 'up', icon: 'clock' },
];

const Dashboard: React.FC<DashboardProps> = ({ onViewChange }) => {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Agency Overview</h1>
          <p className="text-slate-400 text-sm mt-1">Real-time metrics for your restaurant outreach campaigns.</p>
        </div>
        <button 
          onClick={() => onViewChange('LIVE_DEMO')}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-indigo-900/20 flex items-center gap-2"
        >
          <Phone size={16} />
          Launch New Campaign
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <div key={index} className="bg-slate-900 border border-slate-800 p-5 rounded-xl hover:border-slate-700 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-slate-800 rounded-lg text-slate-300">
                {metric.icon === 'phone' && <Phone size={20} />}
                {metric.icon === 'target' && <Target size={20} className="text-green-400" />}
                {metric.icon === 'zap' && <Zap size={20} className="text-yellow-400" />}
                {metric.icon === 'clock' && <Clock size={20} className="text-blue-400" />}
              </div>
              <div className={`flex items-center text-xs font-medium px-2 py-1 rounded ${
                metric.trend === 'up' ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'
              }`}>
                {metric.trend === 'up' ? <ArrowUpRight size={12} className="mr-1" /> : <ArrowDownRight size={12} className="mr-1" />}
                {metric.change}
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-100 mb-1">{metric.value}</div>
            <div className="text-sm text-slate-500">{metric.label}</div>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Bar Chart */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-slate-200">Outreach Performance</h3>
            <div className="flex gap-2">
              <span className="flex items-center text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-indigo-500 mr-2"></span> Calls
              </span>
              <span className="flex items-center text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-cyan-500 mr-2"></span> Booked
              </span>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={outreachData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f1f5f9' }}
                  itemStyle={{ color: '#cbd5e1' }}
                  cursor={{fill: '#1e293b'}}
                />
                <Bar dataKey="calls" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="booked" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Latency Trend Area Chart */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-200">Agent Latency</h3>
            <Zap size={16} className="text-yellow-400" />
          </div>
          <p className="text-xs text-slate-500 mb-6">Response time (ms) over last 7 days</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={latencyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="time" hide />
                <Tooltip 
                   contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f1f5f9' }}
                   itemStyle={{ color: '#fbbf24' }}
                />
                <Area type="monotone" dataKey="ms" stroke="#fbbf24" fill="rgba(251, 191, 36, 0.1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Duration Distribution */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
            <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                    <Timer size={18} className="text-blue-400"/> Call Duration Distribution
                </h3>
            </div>
            <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={durationDistribution} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                        <XAxis type="number" stroke="#64748b" fontSize={12} />
                        <YAxis dataKey="range" type="category" stroke="#94a3b8" fontSize={12} width={60} tickLine={false} />
                        <Tooltip 
                           contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f1f5f9' }}
                           cursor={{fill: '#1e293b'}}
                        />
                        <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Success Trend */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
             <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                    <Activity size={18} className="text-green-400"/> Successful Outreach Rate
                </h3>
            </div>
             <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={outreachData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                       contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f1f5f9' }}
                       itemStyle={{ color: '#10b981' }}
                    />
                    <Line type="monotone" dataKey="booked" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;