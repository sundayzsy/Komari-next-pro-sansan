"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import Loading from "@/components/loading";
import { Brush, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Eye, EyeOff, Gauge, Info, ShieldCheck, Signal, Waves, ArrowRightToLine } from "lucide-react";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PingRecord {
  client: string;
  task_id: number;
  time: string;
  value: number;
}

interface TaskInfo {
  id: number;
  name: string;
  interval: number;
  loss: number;
  p99?: number;
  p50?: number;
  p99_p50_ratio?: number;
  min?: number;
  max?: number;
  avg?: number;
  latest?: number;
  total?: number;
  type?: string;
}

type ChartRow = {
  time: string;
  [taskId: string]: string | number | null | undefined;
};

const colors = ["#ff5da2", "#12cfc1", "#8b7cf6", "#34d399", "#60a5fa", "#f59e0b", "#f87171", "#22d3ee"];
const viewOptions = [
  { label: "1小时", key: "1h", hours: 1 },
  { label: "4小时", key: "4h", hours: 4 },
  { label: "1天", key: "1d", hours: 24 },
];

function formatMs(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return "--";
  return `${value.toFixed(1)} ms`;
}

function formatLoss(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0.0%";
  return `${value.toFixed(1)}%`;
}

function formatPercent(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return `${Math.min(100, Math.max(0, value)).toFixed(1)}%`;
}

function average(values: number[]) {
  if (!values.length) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function downsampleRows(rows: ChartRow[], maxPoints: number) {
  if (maxPoints <= 0 || rows.length <= maxPoints) return rows;
  const step = Math.ceil(rows.length / maxPoints);
  return rows.filter((_, index) => index % step === 0 || index === rows.length - 1);
}

function getTaskValue(task: TaskInfo) {
  return typeof task.latest === "number" ? task.latest : task.avg;
}

function PingTooltip({
  active,
  payload,
  label,
  tasks,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  tasks: TaskInfo[];
}) {
  if (!active || !payload?.length) return null;

  const taskMap = new Map(tasks.map((task) => [String(task.id), task.name]));
  const labelDate = label ? new Date(label) : null;
  const labelText =
    labelDate && !Number.isNaN(labelDate.getTime())
      ? labelDate.toLocaleString([], { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      : "";

  return (
    <div className="ds-ping-tooltip">
      <div className="ds-ping-tooltip-time">{labelText}</div>
      <div className="ds-ping-tooltip-list">
        {payload
          .filter((item) => typeof item.value === "number")
          .map((item) => (
            <div key={item.dataKey} className="ds-ping-tooltip-row">
              <span className="ds-ping-tooltip-dot" style={{ background: item.color }} />
              <span className="ds-ping-tooltip-name">{taskMap.get(String(item.dataKey)) || item.name}</span>
              <strong>{Math.round(Number(item.value))} ms</strong>
            </div>
          ))}
      </div>
    </div>
  );
}

const PingChart = ({
  uuid,
  externalHiddenLines,
  onHiddenLinesChange,
}: {
  uuid: string;
  externalHiddenLines?: Record<string, boolean>;
  onHiddenLinesChange?: (next: Record<string, boolean>) => void;
}) => {
  const { t } = useTranslation();
  const { call } = useRPC2Call();
  const [view, setView] = useState("1h");
  const [remoteData, setRemoteData] = useState<PingRecord[] | null>(null);
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [smooth, setSmooth] = useState(true);
  const [connectBreaks, setConnectBreaks] = useState(false);
  const [quarterSampling, setQuarterSampling] = useState(true);
  const [internalHiddenLines, setInternalHiddenLines] = useState<Record<string, boolean>>({});

  const hiddenLines = externalHiddenLines ?? internalHiddenLines;
  const setHiddenLines = onHiddenLinesChange ?? setInternalHiddenLines;
  const selectedView = viewOptions.find((option) => option.key === view) ?? viewOptions[0];

  useEffect(() => {
    if (!uuid) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        type RpcResp = { count: number; records: PingRecord[]; tasks?: TaskInfo[]; from?: string; to?: string };
        const result = await call<any, RpcResp>("common:getRecords", { uuid, type: "ping", hours: selectedView.hours });
        if (cancelled) return;

        const records = result?.records || [];
        records.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
        const nextTasks = result?.tasks || [];

        setRemoteData(records);
        setTasks(nextTasks);
        const nextHiddenLines = { ...(externalHiddenLines ?? internalHiddenLines) };
        for (const task of nextTasks) {
          if (!(String(task.id) in nextHiddenLines)) nextHiddenLines[String(task.id)] = false;
        }
        if (onHiddenLinesChange) {
          onHiddenLinesChange(nextHiddenLines);
        } else {
          setInternalHiddenLines(nextHiddenLines);
        }
        setInitialized(true);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uuid, selectedView.hours, call]);

  const midData = useMemo(() => {
    const data = remoteData || [];
    if (!data.length) return [];

    const taskIntervals = tasks.map((task) => task.interval).filter((value): value is number => typeof value === "number" && value > 0);
    const fallbackIntervalSec = taskIntervals.length ? Math.min(...taskIntervals) : 60;
    const toleranceMs = Math.min(6000, Math.max(800, Math.floor(fallbackIntervalSec * 1000 * 0.25)));
    const grouped: Record<number, ChartRow> = {};
    const anchors: number[] = [];

    for (const rec of data) {
      const ts = new Date(rec.time).getTime();
      let anchor: number | null = null;

      for (const item of anchors) {
        if (Math.abs(item - ts) <= toleranceMs) {
          anchor = item;
          break;
        }
      }

      const use = anchor ?? ts;
      if (!grouped[use]) {
        grouped[use] = { time: new Date(use).toISOString() };
        if (anchor === null) anchors.push(use);
      }
      grouped[use][String(rec.task_id)] = rec.value < 0 ? null : rec.value;
    }

    return Object.values(grouped).sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }, [remoteData, tasks]);

  const chartData = useMemo(() => {
    const maxPoints = quarterSampling ? 520 : 0;
    return downsampleRows(midData, maxPoints);
  }, [midData, quarterSampling]);

  const summary = useMemo(() => {
    const data = remoteData || [];
    const validValues = data.filter((item) => item.value >= 0).map((item) => item.value);
    const avgLatency = average(validValues) ?? average(tasks.map((task) => task.avg).filter((value): value is number => typeof value === "number"));

    const byTask = new Map<number, PingRecord[]>();
    for (const item of data) {
      if (!byTask.has(item.task_id)) byTask.set(item.task_id, []);
      byTask.get(item.task_id)!.push(item);
    }

    const jitterValues: number[] = [];
    for (const records of byTask.values()) {
      const sorted = [...records].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
      let last: number | null = null;
      for (const record of sorted) {
        if (record.value < 0) {
          last = null;
          continue;
        }
        if (last !== null) jitterValues.push(Math.abs(record.value - last));
        last = record.value;
      }
    }

    const taskJitterValues = tasks
      .map((task) => (typeof task.p99 === "number" && typeof task.p50 === "number" ? Math.max(0, task.p99 - task.p50) : undefined))
      .filter((value): value is number => typeof value === "number");
    const jitter = average(jitterValues) ?? average(taskJitterValues);

    const recordLoss = data.length ? (data.filter((item) => item.value < 0).length / data.length) * 100 : undefined;
    const taskLoss = average(tasks.map((task) => task.loss).filter((value): value is number => typeof value === "number"));
    const lossRate = recordLoss ?? taskLoss;
    const successRate = typeof lossRate === "number" ? 100 - lossRate : undefined;

    return { avgLatency, jitter, lossRate, successRate };
  }, [remoteData, tasks]);

  const yAxisInfo = useMemo(() => {
    let maxValue = 0;
    for (const row of chartData) {
      for (const task of tasks) {
        const value = row[String(task.id)];
        if (typeof value === "number" && Number.isFinite(value)) maxValue = Math.max(maxValue, value);
      }
    }

    const yMax = Math.max(180, Math.ceil(maxValue / 45) * 45);
    const step = yMax / 4;
    return {
      domain: [0, yMax] as [number, number],
      ticks: [0, step, step * 2, step * 3, yMax].map((value) => Math.round(value)),
    };
  }, [chartData, tasks]);

  const timeFormatter = (value: any, index: number) => {
    if (!chartData.length) return "";
    if (index === 0 || index === chartData.length - 1 || index % Math.max(1, Math.floor(chartData.length / 8)) === 0) {
      const date = new Date(value);
      if (selectedView.hours < 24) return date.toLocaleString([], { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
      return date.toLocaleString([], { month: "2-digit", day: "2-digit", hour: "2-digit" });
    }
    return "";
  };

  const toggleTask = (id: number) => {
    const key = String(id);
    setHiddenLines({ ...hiddenLines, [key]: !hiddenLines[key] });
  };

  const toggleAllLines = () => {
    const allHidden = tasks.length > 0 && tasks.every((task) => hiddenLines[String(task.id)]);
    const next: Record<string, boolean> = {};
    tasks.forEach((task) => {
      next[String(task.id)] = !allHidden;
    });
    setHiddenLines(next);
  };

  const allHidden = tasks.length > 0 && tasks.every((task) => hiddenLines[String(task.id)]);

  return (
    <div className="ds-ping-panel ds-ping-purcarte-panel">
      <div className="ds-ping-view-tabs ds-ping-purcarte-view-tabs" aria-label="延迟时间范围">
        {viewOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            className={cn("ds-ping-view-tab", view === option.key && "is-active")}
            onClick={() => setView(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="ds-ping-summary-grid" aria-label="网络质量概览">
        <div className="ds-ping-summary-card">
          <span className="ds-ping-summary-icon"><Gauge size={16} /></span>
          <span className="ds-ping-summary-label">平均延迟</span>
          <strong>{formatMs(summary.avgLatency)}</strong>
        </div>
        <div className="ds-ping-summary-card">
          <span className="ds-ping-summary-icon"><Waves size={16} /></span>
          <span className="ds-ping-summary-label">抖动</span>
          <strong>{formatMs(summary.jitter)}</strong>
        </div>
        <div className="ds-ping-summary-card">
          <span className="ds-ping-summary-icon"><Signal size={16} /></span>
          <span className="ds-ping-summary-label">丢包率</span>
          <strong>{formatPercent(summary.lossRate)}</strong>
        </div>
        <div className="ds-ping-summary-card">
          <span className="ds-ping-summary-icon"><ShieldCheck size={16} /></span>
          <span className="ds-ping-summary-label">成功率</span>
          <strong>{formatPercent(summary.successRate)}</strong>
        </div>
      </div>

      <div className="ds-ping-route-strip">
        <div className="ds-ping-route-strip-inner">
          {tasks.map((task, index) => {
            const hidden = !!hiddenLines[String(task.id)];
            const color = colors[index % colors.length];
            return (
              <button
                key={task.id}
                type="button"
                className={cn("ds-ping-route-chip", hidden && "is-hidden")}
                style={{ "--line-color": color } as CSSProperties}
                title={hidden ? "点击显示该线路" : "点击隐藏该线路"}
                onClick={() => toggleTask(task.id)}
              >
                <strong>{task.name}</strong>
                <span>{formatMs(getTaskValue(task))} | {formatLoss(task.loss)}</span>
              </button>
            );
          })}
          {!tasks.length && !loading ? <div className="ds-ping-route-empty">{t("common.none")}</div> : null}
        </div>
        <Info className="ds-ping-route-info" size={16} />
      </div>

      <div className="ds-ping-chart-glass">
        <div className="ds-ping-chart-toolbar">
          <div className="ds-ping-chart-options">
            <label className="ds-ping-switch-row">
              <Switch className="ds-ping-switch" checked={smooth} onCheckedChange={setSmooth} />
              <span>平滑</span>
            </label>
            <label className="ds-ping-switch-row">
              <Switch className="ds-ping-switch" checked={connectBreaks} onCheckedChange={setConnectBreaks} />
              <span>连接断点</span>
              <Info size={14} className="ds-ping-inline-info" />
            </label>
          </div>

          <div className="ds-ping-chart-actions">
            <Button type="button" variant="ghost" size="sm" className="ds-ping-action-btn" onClick={toggleAllLines}>
              {allHidden ? <Eye size={16} /> : <EyeOff size={16} />}
              <span>{allHidden ? "显示全部" : "隐藏全部"}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn("ds-ping-action-btn", quarterSampling && "is-active")}
              onClick={() => setQuarterSampling((value) => !value)}
            >
              <ArrowRightToLine size={16} />
              <span>四分之一</span>
            </Button>
          </div>
        </div>

        {loading && !initialized ? <div className="ds-ping-state"><Loading /></div> : null}
        {error ? <div className="ds-ping-state ds-ping-state-error">{error}</div> : null}

        {!error && (initialized || !loading) ? (
          <div className="ds-ping-chart-viewport">
            {chartData.length === 0 ? (
              <div className="ds-ping-empty">{t("common.none")}</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 30, bottom: 42, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="rgba(71,85,105,0.56)" strokeDasharray="1 5" />
                  <XAxis
                    dataKey="time"
                    axisLine={{ stroke: "rgba(71,85,105,0.60)" }}
                    tickLine={false}
                    tickMargin={12}
                    minTickGap={24}
                    interval="preserveStartEnd"
                    tickFormatter={timeFormatter}
                    tick={{ fill: "rgba(15,23,42,0.74)", fontSize: 12 }}
                  />
                  <YAxis
                    type="number"
                    domain={yAxisInfo.domain}
                    ticks={yAxisInfo.ticks}
                    allowDecimals={false}
                    axisLine={{ stroke: "rgba(71,85,105,0.60)" }}
                    tickLine={false}
                    tickMargin={-28}
                    width={48}
                    tick={{ fill: "rgba(15,23,42,0.74)", fontSize: 12 }}
                  />
                  <Tooltip content={<PingTooltip tasks={tasks} />} cursor={{ stroke: "rgba(99,102,241,0.26)", strokeWidth: 1 }} />
                  {tasks.map((task, index) => (
                    <Line
                      key={task.id}
                      dataKey={String(task.id)}
                      name={task.name}
                      stroke={colors[index % colors.length]}
                      dot={false}
                      isAnimationActive={false}
                      strokeWidth={2}
                      connectNulls={connectBreaks}
                      type={smooth ? "monotone" : "linear"}
                      hide={!!hiddenLines[String(task.id)]}
                    />
                  ))}
                  <Brush
                    dataKey="time"
                    height={30}
                    travellerWidth={6}
                    stroke="rgba(71,85,105,0.74)"
                    fill="rgba(117,105,150,0.42)"
                    tickFormatter={() => ""}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default PingChart;
