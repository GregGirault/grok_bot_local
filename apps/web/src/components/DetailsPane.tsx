import { useEffect, useState } from 'react';
import { displayName, formatCron } from '@grok-bot/shared';
import type { Agent, ComputerState, Routine, RoutineRun, TeachSession } from '@grok-bot/shared';
import { api } from '../lib/api';
import { t, type Lang } from '../lib/i18n';
import { ExpandIcon } from './Icons';

export default function DetailsPane({
  agent,
  lang,
  onClose,
  onTakeover,
  full = false,
}: {
  agent: Agent;
  lang: Lang;
  onClose: () => void;
  onTakeover: () => void;
  full?: boolean;
}) {
  const [comp, setComp] = useState<ComputerState | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [runs, setRuns] = useState<RoutineRun[]>([]);
  const [teach, setTeach] = useState<TeachSession | null>(null);
  const [goal, setGoal] = useState('');
  const [step, setStep] = useState('');
  const [edit, setEdit] = useState<Routine | null>(null);

  const reload = () => {
    void api.computer(agent.id).then(setComp);
    void api.listRoutines(agent.id).then(setRoutines);
  };

  useEffect(() => {
    reload();
    const tmr = setInterval(() => void api.computer(agent.id).then(setComp), 2500);
    return () => clearInterval(tmr);
  }, [agent.id]);

  const wall = `wall-${comp?.wallpaper ?? 'night'}`;
  const first = displayName(agent.name);

  return (
    <aside className={`${full ? 'w-full h-full' : 'w-[320px]'} shrink-0 border-l flex flex-col`} style={{ borderColor: 'var(--gb-border)', background: 'var(--gb-panel)' }}>
      <div className="h-12 px-3 flex items-center justify-between">
        <span className="text-[13px] font-medium">
          {t(lang, 'screenOf')} {first}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title={t(lang, 'expandScreen')}
            onClick={onTakeover}
            className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-zinc-800"
            style={{ color: 'var(--gb-muted)' }}
          >
            <ExpandIcon />
          </button>
          <button type="button" onClick={onClose} className="h-7 px-2 rounded-md text-[12px] hover:bg-zinc-800" style={{ color: 'var(--gb-muted)' }}>
            {t(lang, 'close')}
          </button>
        </div>
      </div>

      <div className="px-3 pb-3">
        <div className="rounded-xl overflow-hidden border border-zinc-800">
          <div className="h-7 px-2 flex items-center gap-1.5 text-[10px]" style={{ background: '#09090b', color: 'var(--gb-muted)' }}>
            <span className="h-2 w-2 rounded-full bg-zinc-600" />
            <span className="truncate flex-1">{comp?.url || 'workspace://local'}</span>
          </div>
          {(comp?.setupPhase === 'starting' || comp?.setupPhase === 'updating') && (
            <div className="mb-2 rounded-lg bg-zinc-900 px-2 py-1.5 text-[11px]" style={{ color: 'var(--gb-muted)' }}>
              {comp.setupPhase === 'starting' ? t(lang, 'computerStarting') : t(lang, 'computerUpdating')}
            </div>
          )}
          <div className={`relative h-40 ${wall}`}>
            {!comp?.reachable ? (
              <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center bg-black/40 text-white px-4 text-center">
                <p className="text-[12px] mb-2">{t(lang, 'computerUnreachable')}</p>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg bg-white/20 text-[11px]"
                  onClick={() => void api.computerRecover().then(() => reload())}
                >
                  {t(lang, 'recoverFromError')}
                </button>
              </div>
            ) : (
              <>
                <div className="absolute inset-x-3 top-3 text-[11px] text-white/90 drop-shadow z-[1]">
                  {first} · {comp?.active ? t(lang, 'computerActive') : t(lang, 'computerIdle')}
                </div>
                <div className="absolute inset-x-3 bottom-3 space-y-1 max-h-24 overflow-hidden z-[1]">
                  {(comp?.events ?? []).slice(0, 4).map((e) => (
                    <div key={e.id} className="text-[10px] text-white/90 truncate">
                      {e.detail}
                    </div>
                  ))}
                  {!comp?.events?.length && (
                    <div className="text-[10px] text-white/70">{t(lang, 'emptyScreen')}</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          className="mt-2 w-full py-1.5 rounded-lg text-[12px] bg-zinc-800 hover:bg-zinc-700"
          onClick={() => setTeach({ id: '', agentId: agent.id, goal: '', steps: [], status: 'recording', createdAt: '' })}
        >
          {t(lang, 'teachTask')}
        </button>
      </div>

      {teach && (
        <div className="px-3 pb-3 space-y-2">
          {teach.id ? (
            <>
              <p className="text-[12px]">{teach.goal} · {teach.steps.length} étapes</p>
              <input className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-1.5 text-[12px]" placeholder={t(lang, 'addStep')} value={step} onChange={(e) => setStep(e.target.value)} />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 py-1.5 rounded-lg bg-zinc-800 text-[12px]"
                  onClick={() => {
                    if (!step.trim()) return;
                    void api.teachStep(teach.id, 'click', step.trim()).then((s) => { setTeach(s); setStep(''); });
                  }}
                >
                  {t(lang, 'addStep')}
                </button>
                <button
                  type="button"
                  className="flex-1 py-1.5 rounded-lg text-white text-[12px]"
                  style={{ background: 'var(--gb-accent)' }}
                  onClick={() => void api.stopTeach(teach.id).then((s) => setTeach(s))}
                >
                  {t(lang, 'stopRecording')}
                </button>
              </div>
              {teach.status === 'saved' && (
                <button type="button" className="text-[11px]" onClick={() => setTeach(null)}>{t(lang, 'close')}</button>
              )}
            </>
          ) : (
            <>
              <input className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-1.5 text-[12px]" placeholder={t(lang, 'teachGoal')} value={goal} onChange={(e) => setGoal(e.target.value)} />
              <button
                type="button"
                className="w-full py-1.5 rounded-lg text-white text-[12px]"
                style={{ background: 'var(--gb-accent)' }}
                onClick={() => {
                  if (!goal.trim()) return;
                  void api.startTeach(agent.id, goal.trim()).then(setTeach);
                }}
              >
                {t(lang, 'startRecording')}
              </button>
              <button type="button" className="text-[11px]" onClick={() => setTeach(null)}>{t(lang, 'cancel')}</button>
            </>
          )}
        </div>
      )}

      <div className="px-3 pb-2 text-[13px] font-medium">{t(lang, 'routines')}</div>
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
        {routines.length === 0 && (
          <p className="text-[12px]" style={{ color: 'var(--gb-muted)' }}>
            {t(lang, 'noRoutines')}
          </p>
        )}
        {routines.map((r) => (
          <div key={r.id} className="rounded-xl px-3 py-2.5 hover:bg-zinc-900/80">
            {edit?.id === r.id ? (
              <RoutineEditor
                lang={lang}
                routine={edit}
                onCancel={() => setEdit(null)}
                onSaved={() => {
                  setEdit(null);
                  reload();
                }}
              />
            ) : (
              <>
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium truncate">{r.name}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--gb-muted)' }}>
                      {r.enabled ? formatCron(r.cron, lang) : t(lang, 'paused')}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button type="button" className="text-[10px] px-2 py-1 rounded-md bg-zinc-800" onClick={() => void api.runRoutine(r.id).then(() => api.listRoutineRuns(r.id).then(setRuns))} title={t(lang, 'testRunHint')}>
                      {t(lang, 'runNow')}
                    </button>
                    <button type="button" className="text-[10px] px-2 py-1 rounded-md bg-zinc-800" onClick={() => void api.updateRoutine(r.id, { enabled: !r.enabled }).then(reload)}>
                      {r.enabled ? t(lang, 'pause') : t(lang, 'enable')}
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 mt-1">
                  <button type="button" className="text-[10px]" style={{ color: 'var(--gb-muted)' }} onClick={() => setEdit(r)}>{t(lang, 'editRoutine')}</button>
                  <button type="button" className="text-[10px] text-red-400" onClick={() => void api.deleteRoutine(r.id).then(reload)}>{t(lang, 'delete')}</button>
                </div>
                {r.webhookToken && (
                  <div className="text-[10px] mt-1 font-mono truncate" style={{ color: 'var(--gb-muted)' }}>
                    {t(lang, 'webhook')} /api/hooks/{r.id}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        {runs.length > 0 && (
          <div className="text-[11px] space-y-1 pt-2">
            {runs.slice(0, 8).map((run) => (
              <div key={run.id} style={{ color: 'var(--gb-muted)' }}>
                {run.status} · {new Date(run.createdAt).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function RoutineEditor({
  lang,
  routine,
  onCancel,
  onSaved,
}: {
  lang: Lang;
  routine: Routine;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(routine.name);
  const [cron, setCron] = useState(routine.cron);
  const [prompt, setPrompt] = useState(routine.prompt);
  return (
    <div className="space-y-2">
      <input className="w-full rounded bg-zinc-900 border border-zinc-800 px-2 py-1 text-[12px]" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="w-full rounded bg-zinc-900 border border-zinc-800 px-2 py-1 text-[12px] font-mono" value={cron} onChange={(e) => setCron(e.target.value)} />
      <div className="flex flex-wrap gap-1">
        {[
          ['0 8 * * *', '8:00'],
          ['0 8 * * 1-5', 'lun–ven'],
          ['event:webhook', 'webhook'],
          ['event:github', 'GitHub'],
          ['event:slack', 'Slack'],
        ].map(([v, label]) => (
          <button key={v} type="button" className="text-[10px] px-2 py-0.5 rounded bg-zinc-800" onClick={() => setCron(v)}>
            {label}
          </button>
        ))}
      </div>
      <textarea className="w-full rounded bg-zinc-900 border border-zinc-800 px-2 py-1 text-[12px]" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      <div className="flex gap-2">
        <button type="button" className="text-[11px]" onClick={onCancel}>{t(lang, 'cancel')}</button>
        <button
          type="button"
          className="text-[11px] text-white px-2 py-1 rounded"
          style={{ background: 'var(--gb-accent)' }}
          onClick={() => void api.updateRoutine(routine.id, { name, cron, prompt }).then(onSaved)}
        >
          {t(lang, 'save')}
        </button>
      </div>
    </div>
  );
}
