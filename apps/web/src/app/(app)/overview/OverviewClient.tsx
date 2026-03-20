'use client';

import { useState, useCallback } from 'react';
import {
  MessageCircle,
  Users,
  BarChart3,
  MessagesSquare,
  Inbox,
  Archive,
  Bell,
  TrendingUp,
  UserPlus,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Activity,
  Award,
  Layers,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { trpc } from '@/lib/trpc';
import { formatRelative, formatTime } from '@/lib/dayjs';
import { useWorkspace } from '@/hooks/useWorkspace';
import { ChannelFilter } from '@/components/shared/ChannelFilter';
import { NoChannelAccess } from '@/components/ui/NoChannelAccess';
import styles from './page.module.css';

/** Message type label map */
const typeLabel: Record<string, string> = {
  TEXT: '',
  IMAGE: '📷 รูปภาพ',
  VIDEO: '🎥 วิดีโอ',
  AUDIO: '🎵 เสียง',
  STICKER: '😊 สติ๊กเกอร์',
  FILE: '📎 ไฟล์',
  LOCATION: '📍 ตำแหน่ง',
};

const CHART_COLORS = {
  inbound: '#06c755',
  outbound: '#3b82f6',
  total: '#8b5cf6',
};

export default function OverviewClient() {
  const router = useRouter();
  const { accountId, hasAccess } = useWorkspace();
  const [chartDays, setChartDays] = useState(14);

  if (!hasAccess) return <NoChannelAccess />;

  const queryInput = accountId ? { lineAccountId: accountId } : undefined;

  const { data: stats, isLoading: loadingStats } =
    trpc.overview.stats.useQuery(queryInput);

  const { data: timeSeries, isLoading: loadingChart } =
    trpc.overview.messageTimeSeries.useQuery({
      days: chartDays,
      ...(accountId ? { lineAccountId: accountId } : {}),
    });

  const { data: hourlyData } =
    trpc.overview.hourlyHeatmap.useQuery(queryInput);

  const { data: adminPerf } =
    trpc.overview.adminPerformance.useQuery({
      days: 7,
      ...(accountId ? { lineAccountId: accountId } : {}),
    });

  const { data: channelBreakdown } =
    trpc.overview.channelBreakdown.useQuery({ days: 7 });

  const {
    data: activityData,
    isLoading: loadingActivity,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.overview.recentActivity.useInfiniteQuery(
    { limit: 15, ...(accountId ? { lineAccountId: accountId } : {}) },
    { getNextPageParam: (last) => last.nextCursor }
  );

  const activity = activityData?.pages.flatMap((p) => p.items) ?? [];

  const handleActivityScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      if (
        el.scrollHeight - el.scrollTop - el.clientHeight < 100 &&
        hasNextPage &&
        !isFetchingNextPage
      ) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  );

  // Format chart date labels
  const chartData = (timeSeries || []).map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
  }));

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          <BarChart3 size={22} />
          ภาพรวม
        </h1>
      </div>

      <ChannelFilter />

      <div className={styles.content}>
        {/* Stats Grid */}
        <section className={styles.statsGrid}>
          <StatCard
            icon={<MessagesSquare size={20} />}
            label="การสนทนาทั้งหมด"
            value={stats?.totalConversations}
            loading={loadingStats}
            color="green"
          />
          <StatCard
            icon={<Inbox size={20} />}
            label="กำลังดำเนินการ"
            value={stats?.activeConversations}
            loading={loadingStats}
            color="blue"
          />
          <StatCard
            icon={<Bell size={20} />}
            label="ยังไม่อ่าน"
            value={stats?.unreadConversations}
            loading={loadingStats}
            color="orange"
          />
          <StatCard
            icon={<Archive size={20} />}
            label="อาร์ไคฟ์"
            value={stats?.archivedConversations}
            loading={loadingStats}
            color="gray"
          />
          <StatCard
            icon={<Users size={20} />}
            label="ผู้ติดต่อทั้งหมด"
            value={stats?.totalContacts}
            loading={loadingStats}
            color="purple"
          />
          <StatCard
            icon={<UserPlus size={20} />}
            label="ผู้ติดต่อใหม่วันนี้"
            value={stats?.newContactsToday}
            loading={loadingStats}
            color="teal"
          />
          <StatCard
            icon={<ArrowDownLeft size={20} />}
            label="ข้อความเข้าวันนี้"
            value={stats?.inboundToday}
            loading={loadingStats}
            color="green"
          />
          <StatCard
            icon={<ArrowUpRight size={20} />}
            label="ข้อความออกวันนี้"
            value={stats?.outboundToday}
            loading={loadingStats}
            color="blue"
          />
          <StatCard
            icon={<MessageCircle size={20} />}
            label="ข้อความวันนี้"
            value={stats?.messagesToday}
            loading={loadingStats}
            color="green"
          />
          <StatCard
            icon={<TrendingUp size={20} />}
            label="ข้อความสัปดาห์นี้"
            value={stats?.messagesThisWeek}
            loading={loadingStats}
            color="blue"
          />
        </section>

        {/* Message Volume Chart */}
        <section className={styles.chartSection}>
          <div className={styles.chartHeader}>
            <h2 className={styles.sectionTitle}>
              <Activity size={18} />
              ปริมาณข้อความ
            </h2>
            <div className={styles.chartControls}>
              {[7, 14, 30].map((d) => (
                <button
                  key={d}
                  className={`${styles.chartDayBtn} ${chartDays === d ? styles.active : ''}`}
                  onClick={() => setChartDays(d)}
                >
                  {d} วัน
                </button>
              ))}
            </div>
          </div>
          <div className={styles.chartWrap}>
            {loadingChart ? (
              <div className={styles.chartLoading}>กำลังโหลดกราฟ...</div>
            ) : chartData.length === 0 ? (
              <div className={styles.chartLoading}>ไม่มีข้อมูล</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradInbound" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.inbound} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART_COLORS.inbound} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradOutbound" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.outbound} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART_COLORS.outbound} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-text-primary)',
                      boxShadow: 'var(--shadow-sm)',
                      fontSize: '13px',
                    }}
                    labelStyle={{ fontWeight: 600, color: 'var(--color-text-primary)' }}
                    formatter={(value: any, name: any) => [
                      Number(value).toLocaleString(),
                      name === 'inbound' ? 'ข้อความเข้า' : 'ข้อความออก',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="inbound"
                    stroke={CHART_COLORS.inbound}
                    strokeWidth={2}
                    fill="url(#gradInbound)"
                  />
                  <Area
                    type="monotone"
                    dataKey="outbound"
                    stroke={CHART_COLORS.outbound}
                    strokeWidth={2}
                    fill="url(#gradOutbound)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className={styles.chartLegend}>
            <span className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: CHART_COLORS.inbound }} />
              ข้อความเข้า
            </span>
            <span className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: CHART_COLORS.outbound }} />
              ข้อความออก
            </span>
          </div>
        </section>

        {/* Two-column: Hourly Heatmap + Admin Performance */}
        <div className={styles.twoCol}>
          {/* Hourly Activity */}
          <section className={styles.chartSection}>
            <h2 className={styles.sectionTitle}>
              <Clock size={18} />
              ช่วงเวลาที่มีแชทเยอะ (7 วัน)
            </h2>
            <div className={styles.chartWrap}>
              {hourlyData && hourlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={hourlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }}
                      axisLine={false}
                      tickLine={false}
                      interval={2}
                    />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-primary)', fontSize: '13px' }}
                      labelStyle={{ color: 'var(--color-text-primary)' }}
                      formatter={(value: any) => [Number(value).toLocaleString(), 'ข้อความ']}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {hourlyData.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={entry.count > 0
                            ? `rgba(6, 199, 85, ${Math.min(0.3 + (entry.count / Math.max(...hourlyData.map(h => h.count), 1)) * 0.7, 1)})`
                            : 'var(--color-surface-raised)'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className={styles.chartLoading}>ไม่มีข้อมูล</div>
              )}
            </div>
          </section>

          {/* Admin Performance */}
          <section className={styles.chartSection}>
            <h2 className={styles.sectionTitle}>
              <Award size={18} />
              ผลงานแอดมิน (7 วัน)
            </h2>
            <div className={styles.perfList}>
              {(!adminPerf || adminPerf.length === 0) ? (
                <div className={styles.chartLoading}>ยังไม่มีข้อมูล</div>
              ) : (
                adminPerf.map((admin, i) => {
                  const maxCount = adminPerf[0]?.messagesSent || 1;
                  const pct = Math.round((admin.messagesSent / maxCount) * 100);
                  return (
                    <div key={admin.adminId} className={styles.perfItem}>
                      <div className={styles.perfRank}>#{i + 1}</div>
                      <div className={styles.perfInfo}>
                        <div className={styles.perfName}>{admin.name}</div>
                        <div className={styles.perfBar}>
                          <div
                            className={styles.perfBarFill}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <div className={styles.perfCount}>
                        {admin.messagesSent.toLocaleString()}
                        <span className={styles.perfUnit}>ข้อความ</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        {/* Channel Breakdown */}
        {channelBreakdown && channelBreakdown.length > 1 && (
          <section className={styles.chartSection}>
            <h2 className={styles.sectionTitle}>
              <Layers size={18} />
              ปริมาณข้อความตามบัญชี OA (7 วัน)
            </h2>
            <div className={styles.channelGrid}>
              {channelBreakdown.map((ch) => (
                <div key={ch.lineAccountId} className={styles.channelCard}>
                  <div className={styles.channelCardHeader}>
                    {ch.pictureUrl ? (
                      <img src={ch.pictureUrl} alt="" className={styles.channelAvatar} />
                    ) : (
                      <div className={styles.channelAvatarFallback}>
                        {(ch.name || '?').charAt(0)}
                      </div>
                    )}
                    <span className={styles.channelName}>{ch.name || 'LINE OA'}</span>
                  </div>
                  <div className={styles.channelStats}>
                    <div className={styles.channelStat}>
                      <span className={styles.channelStatValue}>{ch.messagesInPeriod.toLocaleString()}</span>
                      <span className={styles.channelStatLabel}>ข้อความ</span>
                    </div>
                    <div className={styles.channelStat}>
                      <span className={styles.channelStatValue}>{ch.totalConversations.toLocaleString()}</span>
                      <span className={styles.channelStatLabel}>สนทนา</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recent Activity */}
        <section className={styles.activitySection}>
          <h2 className={styles.sectionTitle}>กิจกรรมล่าสุด</h2>
          <div className={styles.activityList} onScroll={handleActivityScroll}>
            {loadingActivity ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={styles.activityItem} style={{ pointerEvents: 'none' }}>
                  <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0 }} />
                  <div className={styles.activityInfo} style={{ gap: '8px', justifyContent: 'center' }}>
                    <div className="skeleton" style={{ width: '120px', height: '16px' }} />
                    <div className="skeleton" style={{ width: '80%', height: '14px' }} />
                  </div>
                </div>
              ))
            ) : activity.length === 0 ? (
              <div className={styles.emptyActivity}>ยังไม่มีกิจกรรม</div>
            ) : (
              <>
                {activity.map((msg) => (
                  <button
                    key={msg.id}
                    className={styles.activityItem}
                    onClick={() => router.push(`/inbox/${msg.conversation.id}`)}
                    type="button"
                  >
                    <div className={styles.activityAvatar}>
                      {msg.conversation.contact?.pictureUrl ? (
                        <img
                          src={msg.conversation.contact.pictureUrl}
                          alt=""
                          className={styles.activityAvatarImg}
                        />
                      ) : (
                        <div className={styles.activityAvatarFallback}>
                          {(msg.conversation.contact?.displayName || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className={styles.activityInfo}>
                      <div className={styles.activityTop}>
                        <span className={styles.activityName}>
                          {msg.conversation.contact?.displayName || 'ไม่ทราบชื่อ'}
                        </span>
                        {'lineAccount' in msg.conversation && msg.conversation.lineAccount ? (
                          <span className={styles.activityOaBadge}>
                            {(msg.conversation.lineAccount as { displayName: string }).displayName}
                          </span>
                        ) : null}
                        <span className={styles.activityTime}>
                          {formatRelative(msg.createdAt)}
                        </span>
                      </div>
                      <div className={styles.activityMsg}>
                        <span className={`${styles.activityDirection} ${msg.source === 'OUTBOUND' ? styles.outbound : ''}`}>
                          {msg.source === 'OUTBOUND' ? '→' : '←'}
                        </span>
                        {msg.source === 'OUTBOUND' && msg.sentByName ? (
                          <span className={styles.activityAdmin}>{msg.sentByName}</span>
                        ) : null}
                        <span className={styles.activityText}>
                          {typeLabel[msg.type] || msg.textContent || `[${msg.type}]`}
                        </span>
                        <span className={styles.activityTimestamp}>
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
                {/* Load More */}
                {hasNextPage && (
                  <button
                    className={styles.loadMoreBtn}
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    type="button"
                  >
                    {isFetchingNextPage ? 'กำลังโหลด...' : 'โหลดเพิ่มเติม'}
                  </button>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ---- Stat Card component ---- */
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value?: number;
  loading?: boolean;
  color: 'green' | 'blue' | 'orange' | 'gray' | 'purple' | 'teal';
}

function StatCard({ icon, label, value, loading, color }: StatCardProps) {
  return (
    <div className={`${styles.statCard} ${styles[`stat_${color}`]}`}>
      <div className={styles.statIcon}>{icon}</div>
      <div className={styles.statContent}>
        <span className={styles.statValue}>
          {loading ? (
            <div className="skeleton" style={{ width: '48px', height: '1.2em' }} />
          ) : (
            (value ?? 0).toLocaleString()
          )}
        </span>
        <span className={styles.statLabel}>{label}</span>
      </div>
    </div>
  );
}
