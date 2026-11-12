"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Database, History, Loader2, ShieldCheck } from "lucide-react";
import { AuditLogRecord } from "@/lib/types";

export default function AdminSettingsPage() {
  const [health, setHealth] = useState<{
    ok: boolean;
    database?: string;
  } | null>(null);
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/health").then((r) => r.json()),
      fetch("/api/admin/audit-logs").then((r) => r.json()),
    ])
      .then(([h, l]) => {
        setHealth(h);
        setLogs(l.logs || []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Settings &amp; Security Audit
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Verify administrator credentials, Neon database connection, and review
          system-wide audit logs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
            <ShieldCheck className="w-5 h-5" />
            <span>Single Administrator Policy (Clerk Auth)</span>
          </div>
          <p className="text-xs text-slate-600">
            Backend access is strictly locked to verified email:
          </p>
          <p className="text-sm font-mono font-bold text-slate-900">
            mdpaponmia56@gmail.com
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Database className="w-5 h-5 text-emerald-700" />
            <span>Neon PostgreSQL Database</span>
          </div>
          {health ? (
            <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>
                Connected to database &quot;{health.database || "BS ID"}&quot;
              </span>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Checking connection...</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
          <History className="w-4 h-4 text-slate-600" />
          <h2 className="text-base font-bold text-slate-900">
            Recent Administrator Audit Logs
          </h2>
        </div>

        {loading ? (
          <div className="p-10 flex items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading audit logs...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No audit events recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-4 py-3">Administrator</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-5 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 whitespace-nowrap text-slate-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {log.administrator_email}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold">
                        {log.action_type}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-[11px] text-slate-600 max-w-md truncate">
                      {JSON.stringify(log.updated_values || log.previous_values)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
