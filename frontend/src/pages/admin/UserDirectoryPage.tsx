import React, { useEffect, useState } from 'react';
import {
  Users,
  Shield,
  Trash2,
  KeyRound,
  FileCheck2,
  HelpCircle,
  FolderArchive,
  History,
  AlertTriangle,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { api } from '../../services/api';
import { authService } from '../../services/auth';
import { AdminUser } from '../../types';

export const UserDirectoryPage: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUserForDelete, setSelectedUserForDelete] = useState<AdminUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const currentUser = authService.getUser();

  const fetchUsers = () => {
    setLoading(true);
    api.getAdminUsers()
      .then((data) => {
        setUsers(data);
      })
      .catch((err) => {
        setStatusMessage({ text: err.message || 'Failed to fetch users', type: 'error' });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDeleteUser = async () => {
    if (!selectedUserForDelete) return;
    setIsDeleting(true);
    setStatusMessage(null);
    try {
      const res = await api.deleteAdminUser(selectedUserForDelete.id);
      setStatusMessage({ text: res.message, type: 'success' });
      setSelectedUserForDelete(null);
      fetchUsers();
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Failed to delete user', type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.full_name && u.full_name.toLowerCase().includes(q))
    );
  });

  const totalUsers = users.length;
  const geminiConfiguredCount = users.filter((u) => u.is_gemini_configured).length;
  const adminCount = users.filter((u) => u.role === 'admin').length;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              User Directory
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
              Admin Only
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage registered platform accounts and view isolated workspace resources.
          </p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">{totalUsers}</div>
            <div className="text-xs text-muted-foreground font-medium">Total Registered Users</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">{geminiConfiguredCount}</div>
            <div className="text-xs text-muted-foreground font-medium">Gemini Keys Configured</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">{adminCount}</div>
            <div className="text-xs text-muted-foreground font-medium">Administrators</div>
          </div>
        </div>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs font-medium flex items-center justify-between ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'bg-destructive/10 border border-destructive/20 text-destructive'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs underline hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by username, email, or full name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 text-sm rounded-xl bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[250px]">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-card border border-dashed border-border space-y-3">
          <Users className="w-10 h-10 mx-auto text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">No users found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {search ? 'Try adjusting your search query.' : 'No registered users exist yet.'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Gemini API Key</th>
                  <th className="py-3 px-4">Resources</th>
                  <th className="py-3 px-4">Joined / Active</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map((user) => {
                  const isCurrent = currentUser?.id === user.id;

                  return (
                    <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                      {/* User Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                            {user.username.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-foreground flex items-center space-x-1.5">
                              <span>{user.username}</span>
                              {isCurrent && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/15 text-primary font-bold">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-muted-foreground text-[11px]">{user.email}</div>
                            {user.full_name && (
                              <div className="text-[10px] text-muted-foreground/80">{user.full_name}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            user.role === 'admin'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>

                      {/* Gemini Key */}
                      <td className="py-3.5 px-4">
                        {user.is_gemini_configured ? (
                          <div className="inline-flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded text-[11px]">
                            <CheckCircle2 className="w-3 h-3" />
                            <span className="font-mono">{user.masked_gemini_key || 'Configured'}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[11px] italic">Not set</span>
                        )}
                      </td>

                      {/* Resource Stats */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-2 text-[11px]">
                          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground" title="Quizzes">
                            <FileCheck2 className="w-3 h-3 text-primary" />
                            <span>{user.quizzes_count} quizzes</span>
                          </span>
                          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground" title="Questions">
                            <HelpCircle className="w-3 h-3 text-blue-500" />
                            <span>{user.questions_count} q</span>
                          </span>
                          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground" title="Banks">
                            <FolderArchive className="w-3 h-3 text-amber-500" />
                            <span>{user.banks_count} banks</span>
                          </span>
                          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground" title="Attempts">
                            <History className="w-3 h-3 text-emerald-500" />
                            <span>{user.attempts_count} tests</span>
                          </span>
                        </div>
                      </td>

                      {/* Joined / Last Active */}
                      <td className="py-3.5 px-4 text-muted-foreground">
                        <div className="text-[11px]">
                          {new Date(user.created_at).toLocaleDateString()}
                        </div>
                        {user.last_login_at ? (
                          <div className="text-[10px] text-muted-foreground/75 flex items-center space-x-1 mt-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            <span>{new Date(user.last_login_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-muted-foreground/50">No logins</div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {isCurrent ? (
                          <span className="text-[11px] text-muted-foreground italic px-2 py-1">
                            Current Session
                          </span>
                        ) : (
                          <button
                            onClick={() => setSelectedUserForDelete(user)}
                            className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold text-destructive hover:bg-destructive/10 border border-destructive/20 transition-colors"
                            title={`Delete user ${user.username}`}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Deletion */}
      {selectedUserForDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-card border border-destructive/30 p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-destructive">
              <div className="p-2.5 rounded-xl bg-destructive/10">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Delete User Account</h3>
                <p className="text-xs text-muted-foreground">This action is permanent and cannot be undone.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/50 border border-border text-xs space-y-2">
              <div>
                <span className="font-semibold text-foreground">User:</span>{' '}
                <span className="font-mono text-primary font-bold">{selectedUserForDelete.username}</span> ({selectedUserForDelete.email})
              </div>
              <div className="text-muted-foreground text-[11px] leading-relaxed">
                Deleting this user will cascade-delete:
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-foreground/80">
                  <li><strong>{selectedUserForDelete.quizzes_count}</strong> Quizzes & Assessments</li>
                  <li><strong>{selectedUserForDelete.questions_count}</strong> Isolated Questions</li>
                  <li><strong>{selectedUserForDelete.banks_count}</strong> Question Banks</li>
                  <li><strong>{selectedUserForDelete.attempts_count}</strong> Evaluation Results & Sessions</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedUserForDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={isDeleting}
                className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors shadow-sm"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Confirm Permanent Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
