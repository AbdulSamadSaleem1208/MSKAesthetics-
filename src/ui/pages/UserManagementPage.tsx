import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { ActivityLog, AppUser } from '../../lib/db';
import { initials } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useNotif } from '../../context/NotifContext';

type ActivityType = ActivityLog['type'];

function strengthScore(pw: string): number {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(4, score);
}

export function UserManagementPage({ active }: { active: boolean }) {
  const className = useMemo(() => (active ? 'page active' : 'page'), [active]);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const notify = useNotif();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const selected = useMemo(() => users.find((u) => u.id === selectedId) ?? null, [users, selectedId]);

  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<AppUser['role']>('manager');

  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwShow, setPwShow] = useState(false);

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filter, setFilter] = useState<ActivityType | ''>('');

  const actorNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of users) m.set(u.id, u.name || u.email);
    return m;
  }, [users]);

  async function refresh() {
    const [u, a] = await Promise.all([
      supabase.from('app_users').select('*').order('created_at', { ascending: false }),
      supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(200),
    ]);
    if (u.error) notify(u.error.message);
    if (a.error) notify(a.error.message);
    setUsers((u.data as AppUser[]) ?? []);
    setLogs((a.data as ActivityLog[]) ?? []);
  }

  useEffect(() => {
    void refresh();
    const ch = supabase
      .channel('users-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_users' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, () => void refresh())
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) {
      if (user?.id) setSelectedId(user.id);
      else if (users[0]?.id) setSelectedId(users[0].id);
    }
  }, [selectedId, user?.id, users]);

  useEffect(() => {
    if (!selected) return;
    setEditName(selected.name ?? '');
    setEditRole(selected.role);
  }, [selected]);

  const filteredLogs = useMemo(() => {
    if (!filter) return logs;
    return logs.filter((l) => l.type === filter);
  }, [logs, filter]);

  async function saveUserDetails() {
    if (!selected) return;
    if (!isAdmin) {
      notify('Admin only');
      return;
    }
    const { error } = await supabase
      .from('app_users')
      .update({ name: editName.trim(), role: editRole })
      .eq('id', selected.id);
    if (error) {
      notify(error.message);
      return;
    }
    void supabase
      .from('activity_logs')
      .insert({ type: 'edit', message: `Updated user ${selected.email}`, actor_id: user?.id ?? selected.id });
    notify('User updated');
  }

  async function changePassword() {
    if (!user?.id) {
      notify('Please sign in');
      return;
    }
    if (!selected || selected.id !== user.id) {
      notify('You can only change your own password');
      return;
    }
    if (pw1.length < 8) {
      notify('Password must be at least 8 characters');
      return;
    }
    if (pw1 !== pw2) {
      notify('Passwords do not match');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    if (error) {
      notify(error.message);
      return;
    }
    void supabase.from('activity_logs').insert({ type: 'pw', message: 'Password changed', actor_id: user.id });
    setPw1('');
    setPw2('');
    notify('Password updated');
  }

  async function clearActivityLog() {
    if (!isAdmin) {
      notify('Admin only');
      return;
    }
    const { error } = await supabase.from('activity_logs').delete().neq('id', 0);
    if (error) {
      notify(error.message);
      return;
    }
    notify('Activity log cleared');
  }

  const score = strengthScore(pw1);
  const strengthMsg = score <= 1 ? 'Weak' : score === 2 ? 'Okay' : score === 3 ? 'Strong' : 'Very strong';

  const segOn = (i: number) => {
    if (score <= i) return 'var(--border2)';
    if (score <= 2) return 'var(--amber)';
    if (score === 3) return 'var(--green)';
    return 'var(--gold)';
  };

  return (
    <div className={className} id="page-users">
      <div className="ph">
        <div>
          <h1>User Management</h1>
          <p>Workspace users, passwords &amp; activity logs</p>
        </div>
      </div>

      <div className="um-grid">
        <div>
          <div className="card">
            <div className="card-title">
              Users
              <span>{users.length}</span>
            </div>
            {users.map((u) => {
              const selected = u.id === selectedId;
              const av = u.role === 'admin' ? 'admin-av' : 'manager-av';
              return (
                <div
                  key={u.id}
                  className={selected ? 'user-card selected' : 'user-card'}
                  onClick={() => setSelectedId(u.id)}
                  role="button"
                  tabIndex={0}
                >
                  <div className={`uc-avatar ${av}`}>{initials(u.name || u.email || 'U')}</div>
                  <div className="uc-info">
                    <div className="uc-name">{u.name || '—'}</div>
                    <div className="uc-email">{u.email}</div>
                  </div>
                  <span className={u.role === 'admin' ? 'badge b-gold' : 'badge b-blue'}>{u.role}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="card">
            <div className="card-title">
              Selected User
              <span>{selected ? selected.email : '—'}</span>
            </div>
            {selected ? (
              <div className="form-grid">
                <div className="fg">
                  <label>Name</label>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} disabled={!isAdmin} />
                </div>
                <div className="fg">
                  <label>Role</label>
                  <select value={editRole} onChange={(e) => setEditRole(e.target.value as AppUser['role'])} disabled={!isAdmin}>
                    <option value="manager">manager</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
                <div className="fg">
                  <label>User ID</label>
                  <input value={selected.id} disabled />
                </div>

                <div className="fg full">
                  <div className="btn-row" style={{ marginTop: 0 }}>
                    <button className="btn btn-primary" onClick={() => void saveUserDetails()} type="button" disabled={!isAdmin}>
                      Save Changes
                    </button>
                    {!isAdmin ? (
                      <div className="muted" style={{ alignSelf: 'center' }}>
                        Admin only
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="act-empty">Select a user to view details</div>
            )}
          </div>

          <div className="card">
            <div className="card-title">
              Change Password
              <span>{selected?.id === user?.id ? 'Your account' : 'Restricted'}</span>
            </div>
            {selected?.id !== user?.id ? (
              <div className="act-empty">Only the signed-in user can change their own password.</div>
            ) : (
              <div className="pw-form">
                <div className="pw-inp-wrap">
                  <input
                    className="pw-inp"
                    type={pwShow ? 'text' : 'password'}
                    value={pw1}
                    onChange={(e) => setPw1(e.target.value)}
                    placeholder="New password"
                  />
                  <button className="pw-toggle" onClick={() => setPwShow((v) => !v)} type="button" title="Show/Hide">
                    {pwShow ? 'Hide' : 'Show'}
                  </button>
                </div>
                <div className="pw-inp-wrap">
                  <input
                    className="pw-inp"
                    type={pwShow ? 'text' : 'password'}
                    value={pw2}
                    onChange={(e) => setPw2(e.target.value)}
                    placeholder="Confirm password"
                  />
                </div>
                <div>
                  <div className="pw-strength">
                    <div className="pw-seg" style={{ background: segOn(0) }} />
                    <div className="pw-seg" style={{ background: segOn(1) }} />
                    <div className="pw-seg" style={{ background: segOn(2) }} />
                    <div className="pw-seg" style={{ background: segOn(3) }} />
                  </div>
                  <div className="pw-msg">
                    Strength: {strengthMsg} · Minimum 8 characters
                  </div>
                </div>
                <div className="btn-row" style={{ marginTop: 0 }}>
                  <button className="btn btn-primary" onClick={() => void changePassword()} type="button">
                    Update Password
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title">
              Activity Log
              <span>{filteredLogs.length}</span>
            </div>

            <div className="act-filter-row">
              <button className={filter === '' ? 'act-filter-btn on' : 'act-filter-btn'} onClick={() => setFilter('')} type="button">
                All
              </button>
              {(['add', 'edit', 'del', 'auth', 'pw'] as ActivityType[]).map((t) => (
                <button
                  key={t}
                  className={filter === t ? 'act-filter-btn on' : 'act-filter-btn'}
                  onClick={() => setFilter(t)}
                  type="button"
                >
                  {t}
                </button>
              ))}

              <div style={{ marginLeft: 'auto' }}>
                <button className="btn btn-danger btn-sm" onClick={() => void clearActivityLog()} type="button" disabled={!isAdmin}>
                  Clear Log
                </button>
              </div>
            </div>

            {filteredLogs.length === 0 ? (
              <div className="act-empty">No activity yet</div>
            ) : (
              filteredLogs.slice(0, 80).map((l) => {
                const actor = actorNameById.get(l.actor_id) ?? l.actor_id;
                return (
                  <div className="act-row" key={l.id}>
                    <div className={`act-dot ${l.type}`} />
                    <div className="act-body">
                      <div className="act-text">
                        <strong>{actor}</strong> — {l.message}
                      </div>
                      <div className="act-meta">{new Date(l.created_at).toLocaleString('en-PK')}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
