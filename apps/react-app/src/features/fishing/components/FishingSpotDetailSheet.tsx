/**
 * FishingSpotDetailSheet —— 钓点详情面板（Apple HIG Bottom Sheet）。
 *
 * 复用 BottomSheet 壳（backdrop + 下拉关闭 + 焦点陷阱），
 * 内容按 Apple Maps / Weather 信息架构分层：
 *   · 顶部栏（名称 + 关闭）
 *   · Hero 区（评分星级 + 日期）
 *   · 描述正文（serif 阅读节奏）
 *   · Tag 胶囊行
 *   · 信息组（位置 / 创建时间）— inset-grouped 行
 *   · 操作区（导航主按钮 + 编辑 / 删除次要按钮）
 *
 * 支持内联编辑：点编辑切到表单，保存调 fishingSpotsGateway.update。
 *
 * 数据流：消费 MapMarker（position 供导航 / extraData 供详情展示），
 * 删除 / 更新后 emit 事件通知父组件同步地图标记。
 */
import { useState } from 'react';

import dayjs from 'dayjs';
import {
  CalendarDays,
  MapPin,
  Navigation,
  Pencil,
  Star,
  Trash2,
  X,
} from 'lucide-react';

import { BottomSheet } from '@/components';
import { useNotificationStore } from '@/stores/notificationState';

import { fishingSpotsGateway } from '../api/fishingSpotsGateway';
import type { MapMarker } from '@/types/marker';
import type { SpotDetail, UpdateFishingSpotPayload } from '../types';

interface FishingSpotDetailSheetProps {
  open: boolean;
  onClose: () => void;
  /** 完整 MapMarker: extraData 供详情展示, position 供导航 */
  marker: MapMarker | null;
  /** 导航按钮点击 —— 父组件执行路线规划 */
  onRoute?: (marker: MapMarker) => void;
  /** 钓点字段更新后通知父组件同步 marker.extraData */
  onSpotUpdated?: (marker: MapMarker) => void;
  /** 钓点被删除后通知父组件同步地图标记 */
  onSpotDeleted?: (id: string) => void;
}

export function FishingSpotDetailSheet({
  open,
  onClose,
  marker,
  onRoute,
  onSpotUpdated,
  onSpotDeleted,
}: FishingSpotDetailSheetProps) {
  const spot = marker?.extraData as SpotDetail | undefined;
  const position = marker?.position;

  // ── 内联编辑 ──
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editRating, setEditRating] = useState(0);
  const [saving, setSaving] = useState(false);

  // ── 删除确认 ──
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const startEdit = () => {
    if (!spot) return;
    setEditName(spot.name ?? '');
    setEditDescription(spot.description ?? '');
    setEditTags((spot.tags ?? []).join(', '));
    setEditRating(spot.rating ?? 0);
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const saveEdit = async () => {
    if (!spot) return;
    setSaving(true);
    try {
      const tags = editTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const payload: UpdateFishingSpotPayload = {
        name: editName.trim(),
        description: editDescription.trim(),
        tags,
        rating: editRating,
      };
      await fishingSpotsGateway.update(spot.id, payload);
      setEditing(false);
      onSpotUpdated?.({
        ...marker!,
        extraData: {
          ...spot,
          ...payload,
          tags,
          updated_at: new Date().toISOString(),
        },
      });
    } catch (err: unknown) {
      useNotificationStore
        .getState()
        .error(err instanceof Error ? err.message : '更新钓点失败');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => setDeleteOpen(true);

  const doDelete = async () => {
    if (!spot) return;
    setDeleting(true);
    try {
      await fishingSpotsGateway.remove(spot.id);
      setDeleteOpen(false);
      onSpotDeleted?.(spot.id);
      onClose();
    } catch (err: unknown) {
      useNotificationStore
        .getState()
        .error(err instanceof Error ? err.message : '删除钓点失败');
    } finally {
      setDeleting(false);
    }
  };

  // ── 派生文案 ──
  const dateLabel = spot?.created_at
    ? `记于 ${dayjs(spot.created_at).format('YYYY-MM-DD')}`
    : '';
  const coordinateLabel = position
    ? `${position[0].toFixed(4)}, ${position[1].toFixed(4)}`
    : '';

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      lockScroll
      renderHeader={() => (
        <header className="shrink-0 px-5 pt-3 pb-4">
          <div className="/60 flex items-center justify-between border-b px-0 pb-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-ink truncate text-base font-semibold">
                {spot?.name || '钓点详情'}
              </h2>
              {dateLabel && (
                <p className="text-muted mt-0.5 text-xs">{dateLabel}</p>
              )}
            </div>
            <button
              type="button"
              aria-label="关闭钓点详情"
              onClick={onClose}
              className="text-muted hover:bg-surface hover:text-ink ml-3 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>
      )}
    >
      <div className="flex flex-col gap-5 px-5 pt-1 pb-8">
        {editing ? (
          <EditForm
            name={editName}
            description={editDescription}
            tags={editTags}
            rating={editRating}
            saving={saving}
            onNameChange={setEditName}
            onDescriptionChange={setEditDescription}
            onTagsChange={setEditTags}
            onRatingChange={setEditRating}
            onSave={saveEdit}
            onCancel={cancelEdit}
          />
        ) : (
          <>
            {/* 评分星级 — Apple Weather 大数字区同层 */}
            {spot?.rating !== undefined && <RatingRow rating={spot.rating} />}

            {/* 描述正文 — serif 阅读节奏 */}
            {spot?.description && (
              <p className="text-ink/90 font-family-averia text-[15px] leading-relaxed">
                {spot.description}
              </p>
            )}

            {/* Tag 胶囊行 */}
            {spot?.tags && spot.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {spot.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-surface text-muted rounded-full px-3 py-1 text-xs font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* 信息组 — inset-grouped 行 */}
            <div className="fm-grouped divide-border/40 divide-y">
              {coordinateLabel && (
                <InfoRow
                  icon={<MapPin className="h-3.5 w-3.5" />}
                  label="位置"
                  value={coordinateLabel}
                />
              )}
              {spot?.created_at && (
                <InfoRow
                  icon={<CalendarDays className="h-3.5 w-3.5" />}
                  label="创建时间"
                  value={dayjs(spot.created_at).format('YYYY-MM-DD HH:mm')}
                />
              )}
            </div>

            {/* 操作区 */}
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => onRoute?.(marker!)}
                disabled={!marker}
                className="bg-accent text-ink hover:bg-accent/90 flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-colors disabled:opacity-60"
              >
                <Navigation className="h-4 w-4" />
                导航到此处
              </button>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={startEdit}
                  className="text-muted hover:bg-surface flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border px-5 text-sm font-medium transition-colors"
                >
                  <Pencil className="h-4 w-4" />
                  编辑
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="text-destructive hover:bg-destructive/10 flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  删除
                </button>
              </div>
            </div>
          </>
        )}

        {/* 删除确认 */}
        {deleteOpen && (
          <div className="/60 border-t pt-4">
            <p className="text-muted mb-3 text-sm">
              删除钓点「{spot?.name ?? ''}」？软删可在后端恢复。
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                className="text-muted hover:bg-surface min-h-11 flex-1 rounded-full border px-5 text-sm font-medium transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={doDelete}
                disabled={deleting}
                className="bg-destructive text-ink hover:bg-destructive/90 min-h-11 flex-1 rounded-full px-5 text-sm font-medium transition-colors disabled:opacity-60"
              >
                {deleting ? '删除中…' : '确认删除'}
              </button>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

// ── 评分星级 ──
function RatingRow({ rating }: { rating: number }) {
  const stars = Math.round(rating);
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-5 w-5 ${
            i < stars ? 'fill-warning text-warning' : 'text-ink/15'
          }`}
        />
      ))}
      <span className="text-ink ml-1 text-sm font-semibold tabular-nums">
        {rating.toFixed(1)}
      </span>
    </div>
  );
}

// ── inset-grouped 信息行 ──
function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-muted flex items-center gap-2 text-xs font-medium">
        {icon}
        {label}
      </span>
      <span className="text-ink text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}

// ── 内联编辑表单 ──
interface EditFormProps {
  name: string;
  description: string;
  tags: string;
  rating: number;
  saving: boolean;
  onNameChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onTagsChange: (v: string) => void;
  onRatingChange: (v: number) => void;
  onSave: () => void;
  onCancel: () => void;
}

function EditForm({
  name,
  description,
  tags,
  rating,
  saving,
  onNameChange,
  onDescriptionChange,
  onTagsChange,
  onRatingChange,
  onSave,
  onCancel,
}: EditFormProps) {
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-muted text-xs font-medium">名称</span>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="border-input bg-page text-ink focus:border-ring focus:ring-ring/20 min-h-11 rounded-xl border px-3.5 text-sm outline-none focus:ring-2"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-muted text-xs font-medium">描述</span>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={3}
          className="border-input bg-page text-ink focus:border-ring focus:ring-ring/20 resize-none rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed outline-none focus:ring-2"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-muted text-xs font-medium">标签（逗号分隔）</span>
        <input
          type="text"
          value={tags}
          onChange={(e) => onTagsChange(e.target.value)}
          className="border-input bg-page text-ink focus:border-ring focus:ring-ring/20 min-h-11 rounded-xl border px-3.5 text-sm outline-none focus:ring-2"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-muted text-xs font-medium">评分</span>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onRatingChange(i + 1)}
              aria-label={`${i + 1} 星`}
              className="p-0.5"
            >
              <Star
                className={`h-6 w-6 transition-colors ${
                  i < rating
                    ? 'fill-warning text-warning'
                    : 'text-ink/15 hover:text-ink/30'
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2.5 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="text-muted hover:bg-surface min-h-11 flex-1 rounded-full border px-5 text-sm font-medium transition-colors"
        >
          取消
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="bg-accent text-ink hover:bg-accent/90 min-h-11 flex-1 rounded-full px-5 text-sm font-medium transition-colors disabled:opacity-60"
        >
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
    </div>
  );
}
