import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { initials } from '../lib/format';

function pageFromPath(pathname: string): string {
  const p = pathname.replace(/^\//, '');
  if (!p) return 'dashboard';
  return p;
}

function pathForPage(page: string): string {
  if (page === 'dashboard') return '/dashboard';
  if (page === 'stock') return '/stock';
  if (page === 'analytics') return '/analytics';
  if (page === 'sales') return '/sales';
  if (page === 'add-sale') return '/add-sale';
  if (page === 'restock') return '/restock';
  if (page === 'quotes') return '/quotes';
  if (page === 'users') return '/users';
  if (page === 'config') return '/config';
  return '/dashboard';
}

export function Sidebar({
  lowStockBadge,
  quotesBadge,
}: {
  lowStockBadge: boolean;
  quotesBadge: number;
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const active = pageFromPath(pathname);
  const isAdmin = user?.role === 'admin';

  const roleLabel = useMemo(() => {
    return isAdmin ? 'Administrator' : 'Manager';
  }, [isAdmin]);

  const roleClass = useMemo(() => {
    return isAdmin ? 'user-role role-admin' : 'user-role role-manager';
  }, [isAdmin]);

  return (
    <div className="sidebar">
      <div className="s-logo">
        MSK<em>Aesthetics</em>
      </div>

      <div className="s-section">Overview</div>
      {isAdmin && (
        <button
          className={active === 'dashboard' ? 'nav active' : 'nav'}
          onClick={() => navigate(pathForPage('dashboard'))}
          type="button"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
          Dashboard
        </button>
      )}
      <button
        className={active === 'stock' ? 'nav active' : 'nav'}
        onClick={() => navigate(pathForPage('stock'))}
        type="button"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
          <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
        </svg>
        Stock Levels
        <span className="badge" id="low-badge" style={{ display: lowStockBadge ? '' : 'none' }}>
          !
        </span>
      </button>

      <button
        className={active === 'analytics' ? 'nav active' : 'nav'}
        onClick={() => navigate(pathForPage('analytics'))}
        type="button"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        Analytics
      </button>

      <div className="s-section">Transactions</div>
      <button
        className={active === 'sales' ? 'nav active' : 'nav'}
        onClick={() => navigate(pathForPage('sales'))}
        type="button"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        Sales Log
      </button>
      <button
        className={active === 'add-sale' ? 'nav active' : 'nav'}
        onClick={() => navigate(pathForPage('add-sale'))}
        type="button"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
        Add Sale
      </button>
      <button
        className={active === 'restock' ? 'nav active' : 'nav'}
        onClick={() => navigate(pathForPage('restock'))}
        type="button"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
        </svg>
        Restock
      </button>
      <button
        className={active === 'quotes' ? 'nav active' : 'nav'}
        onClick={() => navigate(pathForPage('quotes'))}
        type="button"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <line x1="12" y1="17" x2="8" y2="17" />
        </svg>
        Quotes / Invoices
        <span
          className="badge"
          id="quotes-badge"
          style={{
            display: quotesBadge ? '' : 'none',
            background: 'var(--blue-bg)',
            color: 'var(--blue)',
          }}
        >
          {quotesBadge}
        </span>
      </button>

      <div className="s-section" id="nav-settings-section" style={{ display: isAdmin ? '' : 'none' }}>
        Settings
      </div>
      <button
        className={active === 'users' ? 'nav active' : 'nav'}
        id="nav-users"
        onClick={() => navigate(pathForPage('users'))}
        style={{ display: isAdmin ? '' : 'none' }}
        type="button"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87" />
          <path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
        User Management
      </button>
      <button
        className={active === 'config' ? 'nav active' : 'nav'}
        id="nav-config"
        onClick={() => navigate(pathForPage('config'))}
        style={{ display: isAdmin ? '' : 'none' }}
        type="button"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
        Configuration
      </button>

      <div className="user-pill">
        <div className="avatar" id="avatar">
          {initials(user?.name ?? '')}
        </div>
        <div>
          <div className="user-name" id="uname">
            {user?.name ?? ''}
          </div>
          <div className={roleClass} id="user-role-label">
            {roleLabel}
          </div>
        </div>
        <button
          className="logout"
          onClick={() => void signOut()}
          title="Sign out"
          type="button"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
