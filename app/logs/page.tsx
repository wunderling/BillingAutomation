'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Terminal as TerminalIcon, 
  TerminalSquare,
  Search, 
  RefreshCw, 
  ChevronRight, 
  ChevronDown, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  Loader2,
  Calendar,
  Layers,
  ExternalLink
} from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type Run = {
  id: string
  type: 'ingest' | 'post-approved' | string
  status: 'ok' | 'error' | 'running'
  started_at: string
  ended_at: string | null
  message: string
  details: any
}

export default function LogsPage() {
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'ingest' | 'post-approved'>('all')
  const [searchTerm, setSearchTerm] = useState('')

  const supabase = createClient()

  const fetchLogs = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      let query = supabase
        .from('runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(100)

      if (filter !== 'all') {
        query = query.eq('type', filter)
      }

      const { data, error } = await query

      if (error) throw error
      setRuns(data as Run[])
    } catch (err) {
      console.error('Error fetching logs:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [supabase, filter])

  useEffect(() => {
    fetchLogs()
    
    // Subscribe to real-time updates
    const channel = supabase
        .channel('runs-updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'runs' }, () => {
            fetchLogs(true)
        })
        .subscribe()

    return () => {
        supabase.removeChannel(channel)
    }
  }, [fetchLogs, supabase])

  const filteredRuns = runs.filter(run => 
    run.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    run.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    run.status?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok': return <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      case 'error': return <AlertCircle className="w-4 h-4 text-rose-500" />
      case 'running': return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
      default: return <Clock className="w-4 h-4 text-zinc-400" />
    }
  }

  const getTimeDiff = (start: string, end: string | null) => {
    if (!end) return 'Ongoing'
    const diff = new Date(end).getTime() - new Date(start).getTime()
    return `${(diff / 1000).toFixed(2)}s`
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-300 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <TerminalIcon className="w-6 h-6 text-emerald-400" />
              </div>
              System Debug Terminal
            </h1>
            <p className="text-zinc-500 text-sm">Monitor real-time ingest pipeline and QBO processing logs.</p>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => fetchLogs(true)}
              disabled={refreshing}
              className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg transition-all flex items-center gap-2 text-sm font-medium disabled:opacity-50"
            >
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters/Search Bar */}
        <div className="bg-zinc-900/50 border border-zinc-800 p-3 rounded-xl flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
            {(['all', 'ingest', 'post-approved'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={cn(
                  "px-4 py-1.5 rounded-md text-xs font-medium transition-all",
                  filter === t 
                    ? "bg-zinc-800 text-white shadow-lg" 
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {t.charAt(0).toUpperCase() + t.slice(1).replace('-', ' ')}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
            <input 
              type="text" 
              placeholder="Search logs (e.g. error, Johnny, ingest)..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all text-white placeholder:text-zinc-600"
            />
          </div>
        </div>

        {/* Terminal Window */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col min-h-[600px]">
          {/* Terminal Headers */}
          <div className="px-4 py-3 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5 mr-4">
                <div className="w-3 h-3 rounded-full bg-rose-500/20 border border-rose-500/40" />
                <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/40" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/40" />
              </div>
              <TerminalSquare className="w-4 h-4 text-zinc-500" />
              <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Console.runs[history]</span>
            </div>
            <div className="text-[10px] font-mono text-zinc-600 flex items-center gap-4">
               <span className="flex items-center gap-1"><Layers className="w-3 h-3"/> Active: {runs.filter(r => r.status === 'running').length}</span>
               <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Ok: {runs.filter(r => r.status === 'ok').length}</span>
            </div>
          </div>

          {/* Log Content */}
          <div className="flex-1 overflow-y-auto font-mono text-sm">
            {loading ? (
              <div className="h-full flex items-center justify-center flex-col gap-4">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                <p className="text-zinc-600 animate-pulse">Initializing debug interface...</p>
              </div>
            ) : filteredRuns.length === 0 ? (
              <div className="h-full flex items-center justify-center flex-col gap-2 p-20 text-zinc-600">
                <TerminalIcon className="w-12 h-12 opacity-10 mb-4" />
                <p>No log entries found matching criteria.</p>
                <p className="text-xs opacity-50">System is idle or filter is too restrictive.</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-900">
                {filteredRuns.map((run) => (
                  <div 
                    key={run.id} 
                    className={cn(
                      "group flex flex-col transition-all border-l-2",
                      run.status === 'error' ? "border-rose-500/50 bg-rose-500/5" : 
                      run.status === 'running' ? "border-blue-500/50 bg-blue-500/5" :
                      "border-transparent hover:bg-white/[0.02]"
                    )}
                  >
                    <div 
                      className="px-4 py-3 flex items-start gap-4 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === run.id ? null : run.id)}
                    >
                      <div className="mt-0.5 shrink-0 opacity-70">
                        {getStatusIcon(run.status)}
                      </div>
                      
                      <div className="flex-1 space-y-1">
                        <div className="flex flex-col md:flex-row md:items-center gap-x-4">
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded border leading-none font-bold tracking-tight uppercase",
                            run.type === 'ingest' ? "text-cyan-400 border-cyan-400/20 bg-cyan-400/10" : "text-purple-400 border-purple-400/20 bg-purple-400/10"
                          )}>
                            {run.type}
                          </span>
                          <span className="text-zinc-500 text-xs mt-1 md:mt-0 font-light">
                            {new Date(run.started_at).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })}
                          </span>
                        </div>
                        <p className={cn(
                          "text-sm",
                          run.status === 'error' ? "text-rose-200" : "text-zinc-300"
                        )}>
                          {run.message}
                        </p>
                      </div>

                      <div className="shrink-0 flex items-center gap-3">
                        <span className="text-[10px] text-zinc-600 font-mono hidden md:inline">
                          {getTimeDiff(run.started_at, run.ended_at)}
                        </span>
                        <div className="w-6 h-6 rounded-md group-hover:bg-zinc-800 flex items-center justify-center transition-colors">
                          {expandedId === run.id ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
                        </div>
                      </div>
                    </div>

                    {/* Expandable JSON Detail */}
                    {expandedId === run.id && (
                      <div className="px-12 pb-4 animate-in slide-in-from-top-1 duration-200">
                        <div className="bg-[#0c0c0e] rounded-xl border border-zinc-800/80 p-4 font-mono text-[11px] leading-relaxed relative group overflow-hidden">
                          <div className="absolute top-3 right-3 text-[9px] text-zinc-700 flex items-center gap-2 pointer-events-none select-none">
                            <Layers className="w-3 h-3" />
                            RAW_PAYLOAD
                          </div>
                          
                          {run.details ? (
                            <pre className="text-zinc-400 overflow-x-auto">
                              {JSON.stringify(run.details, null, 2)}
                            </pre>
                          ) : (
                            <div className="text-zinc-700 italic flex items-center gap-2 py-2">
                              <AlertCircle className="w-3 h-3" />
                              No additional payload metadata recorded for this run.
                            </div>
                          )}

                          {/* Action Bar for Detail */}
                          <div className="mt-4 pt-4 border-t border-zinc-900 flex items-center gap-3">
                            <span className="text-[10px] text-zinc-600 uppercase tracking-tighter">Event_ID: {run.id}</span>
                            {run.details?.google_event_id && (
                              <button className="text-[10px] text-emerald-500 hover:text-emerald-400 flex items-center gap-1 transition-colors">
                                <ExternalLink className="w-3 h-3" /> View Source
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status Bar */}
          <div className="px-4 py-2 bg-[#0c0c0e] border-t border-zinc-900 text-[10px] text-zinc-600 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Last sync: {new Date().toLocaleTimeString()}</span>
              <span className="hidden md:inline text-zinc-800">|</span>
              <span className="hidden md:inline">Storage: public.runs</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Real-time synchronization active
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
