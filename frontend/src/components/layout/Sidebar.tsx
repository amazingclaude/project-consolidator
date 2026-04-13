import { NavLink } from 'react-router-dom';
import {
  Zap,
  BarChart3,
  Calendar,
  DollarSign,
  AlertTriangle,
  Search,
  MessageSquare,
  Upload,
  Layers,
  CalendarRange,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Planning',
    items: [
      { to: '/', label: 'FY Planning', icon: <CalendarRange size={18} /> },
    ],
  },
  {
    title: 'Portfolio',
    items: [
      { to: '/portfolio', label: 'Portfolio', icon: <BarChart3 size={18} /> },
      { to: '/schedule', label: 'Schedule Analysis', icon: <Calendar size={18} /> },
      { to: '/cost', label: 'Cost Analysis', icon: <DollarSign size={18} /> },
    ],
  },
  {
    title: 'Projects',
    items: [
      { to: '/plans', label: 'Plan View', icon: <Layers size={18} /> },
      { to: '/projects', label: 'Project Deep Dive', icon: <Search size={18} /> },
    ],
  },
  {
    title: 'Optional',
    items: [
      { to: '/red-line', label: 'Red Line Report', icon: <AlertTriangle size={18} /> },
    ],
  },
  {
    title: 'AI',
    items: [
      { to: '/nl-query', label: 'NL Query', icon: <MessageSquare size={18} /> },
    ],
  },
  {
    title: 'Admin',
    items: [
      { to: '/ingestion', label: 'Data Ingestion', icon: <Upload size={18} /> },
    ],
  },
];

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-sidebar">
      {/* Logo / Title */}
      <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-5">
        <Zap size={22} className="text-primary" />
        <span className="text-lg font-semibold text-white tracking-tight">
          Portfolio Consolidator
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navSections.map((section) => (
          <div key={section.title} className="mb-5">
            <h3 className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {section.title}
            </h3>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-sidebar-hover text-white'
                          : 'text-sidebar-text hover:bg-sidebar-hover/60 hover:text-white'
                      }`
                    }
                  >
                    {item.icon}
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Version */}
      <div className="border-t border-white/10 px-5 py-3">
        <span className="text-xs text-slate-500">v3.0</span>
      </div>
    </aside>
  );
}
