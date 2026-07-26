import { momentsService, type MomentsService } from '@/features/moments';
import type {
  Moment,
  MomentCreatePayload,
  MomentListResponse,
  MomentStatus,
  MomentUpdatePayload,
} from '@/types';
import { create } from 'zustand';

interface ListPublicParams {
  page?: number;
  page_size?: number;
  tag?: string;
}

interface ListAdminParams {
  page?: number;
  page_size?: number;
  status?: MomentStatus;
}

interface MomentsState {
  // 公共列表
  publicList: Moment[];
  publicTotal: number;
  publicPage: number;
  publicPageSize: number;
  publicActiveTag: string | null;

  // 管理员列表
  adminList: Moment[];
  adminTotal: number;
  adminPage: number;
  adminPageSize: number;
  adminStatus: MomentStatus | null;

  // 当前条目
  current: Moment | null;

  // 通用状态
  loading: boolean;
  submitting: boolean;
  error: string | null;

  // actions
  resetPublic: () => void;
  resetAdmin: () => void;
  fetchPublic: (params?: ListPublicParams) => Promise<MomentListResponse>;
  fetchAdmin: (params?: ListAdminParams) => Promise<MomentListResponse>;
  fetchOne: (id: string, admin?: boolean) => Promise<Moment>;
  create: (payload: MomentCreatePayload) => Promise<Moment>;
  update: (id: string, payload: MomentUpdatePayload) => Promise<Moment>;
  remove: (id: string) => Promise<void>;
}

const EMPTY_LIST: MomentListResponse = {
  moments: [],
  total: 0,
  page: 1,
  page_size: 20,
};

const readError = (err: unknown, fallback: string): string => {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};

export const useMomentsStore = create<MomentsState>((set, get) => {
  const service: MomentsService = momentsService();

  return {
    publicList: EMPTY_LIST.moments,
    publicTotal: EMPTY_LIST.total,
    publicPage: EMPTY_LIST.page,
    publicPageSize: EMPTY_LIST.page_size,
    publicActiveTag: null,

    adminList: EMPTY_LIST.moments,
    adminTotal: EMPTY_LIST.total,
    adminPage: EMPTY_LIST.page,
    adminPageSize: EMPTY_LIST.page_size,
    adminStatus: null,

    current: null,

    loading: false,
    submitting: false,
    error: null,

    resetPublic: () =>
      set({
        publicList: EMPTY_LIST.moments,
        publicTotal: EMPTY_LIST.total,
        publicPage: EMPTY_LIST.page,
        publicPageSize: EMPTY_LIST.page_size,
        publicActiveTag: null,
      }),

    resetAdmin: () =>
      set({
        adminList: EMPTY_LIST.moments,
        adminTotal: EMPTY_LIST.total,
        adminPage: EMPTY_LIST.page,
        adminPageSize: EMPTY_LIST.page_size,
        adminStatus: null,
      }),

    fetchPublic: async (params = {}) => {
      const state = get();
      const page = params.page ?? state.publicPage;
      const page_size = params.page_size ?? state.publicPageSize;
      const tag = params.tag !== undefined ? params.tag : state.publicActiveTag;
      set({ loading: true, error: null });
      try {
        const data = await service.listPublic({
          page,
          page_size,
          tag: tag ?? undefined,
        });
        set({
          publicList: data.moments,
          publicTotal: data.total,
          publicPage: data.page,
          publicPageSize: data.page_size,
          publicActiveTag: tag ?? null,
        });
        return data;
      } catch (err) {
        set({ error: readError(err, '加载碎碎念失败') });
        throw err;
      } finally {
        set({ loading: false });
      }
    },

    fetchAdmin: async (params = {}) => {
      const state = get();
      const page = params.page ?? state.adminPage;
      const page_size = params.page_size ?? state.adminPageSize;
      const status =
        params.status !== undefined ? params.status : state.adminStatus;
      set({ loading: true, error: null });
      try {
        const data = await service.listAdmin({
          page,
          page_size,
          status: status ?? undefined,
        });
        set({
          adminList: data.moments,
          adminTotal: data.total,
          adminPage: data.page,
          adminPageSize: data.page_size,
          adminStatus: status ?? null,
        });
        return data;
      } catch (err) {
        set({ error: readError(err, '加载碎碎念失败') });
        throw err;
      } finally {
        set({ loading: false });
      }
    },

    fetchOne: async (id, admin = false) => {
      set({ loading: true, error: null });
      try {
        const moment = admin
          ? await service.getAdmin(id)
          : await service.get(id);
        set({ current: moment });
        return moment;
      } catch (err) {
        set({ error: readError(err, '加载碎碎念失败') });
        throw err;
      } finally {
        set({ loading: false });
      }
    },

    create: async (payload) => {
      set({ submitting: true, error: null });
      try {
        const moment = await service.create(payload);
        return moment;
      } catch (err) {
        set({ error: readError(err, '发布碎碎念失败') });
        throw err;
      } finally {
        set({ submitting: false });
      }
    },

    update: async (id, payload) => {
      set({ submitting: true, error: null });
      try {
        const moment = await service.update(id, payload);
        const state = get();
        set({
          current: state.current?.id === id ? moment : state.current,
        });
        return moment;
      } catch (err) {
        set({ error: readError(err, '更新碎碎念失败') });
        throw err;
      } finally {
        set({ submitting: false });
      }
    },

    remove: async (id) => {
      set({ submitting: true, error: null });
      try {
        await service.remove(id);
        const state = get();
        set({
          publicList: state.publicList.filter((m) => m.id !== id),
          adminList: state.adminList.filter((m) => m.id !== id),
          current: state.current?.id === id ? null : state.current,
        });
      } catch (err) {
        set({ error: readError(err, '删除碎碎念失败') });
        throw err;
      } finally {
        set({ submitting: false });
      }
    },
  };
});
