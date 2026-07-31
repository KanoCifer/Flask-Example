import { momentsGateway } from '@readinglist/api';
import type {
  ListAdminMomentsParams,
  ListPublicMomentsParams,
} from '@readinglist/types';
import type {
  Moment,
  MomentCreatePayload,
  MomentListResponse,
  MomentStatus,
  MomentUpdatePayload,
} from '@readinglist/types';
import { defineStore } from 'pinia';
import { ref } from 'vue';

const EMPTY_LIST: MomentListResponse = {
  moments: [],
  total: 0,
  page: 1,
  page_size: 20,
};

/**
 * 纯 list-state store：公共 / 管理员两套列表各自维护 loading 标志，
 * 提交态（submitting）由 [[MomentComposer]] 与视图共同管理，store 不再背锅。
 */
export const useMomentsStore = defineStore('moments', () => {
  // ───────────── 公共列表状态 ─────────────
  const publicList = ref<Moment[]>([]);
  const publicTotal = ref(0);
  const publicPage = ref(1);
  const publicPageSize = ref(20);
  const publicActiveTag = ref<string | null>(null);
  const publicLoading = ref(false);

  // ───────────── 管理员列表状态 ─────────────
  const adminList = ref<Moment[]>([]);
  const adminTotal = ref(0);
  const adminPage = ref(1);
  const adminPageSize = ref(20);
  const adminStatus = ref<MomentStatus | null>(null);
  const adminLoading = ref(false);

  // ───────────── 当前条目 ─────────────
  const current = ref<Moment | null>(null);

  function resetPublic() {
    publicList.value = EMPTY_LIST.moments;
    publicTotal.value = EMPTY_LIST.total;
    publicPage.value = EMPTY_LIST.page;
    publicPageSize.value = EMPTY_LIST.page_size;
    publicActiveTag.value = null;
  }

  function resetAdmin() {
    adminList.value = EMPTY_LIST.moments;
    adminTotal.value = EMPTY_LIST.total;
    adminPage.value = EMPTY_LIST.page;
    adminPageSize.value = EMPTY_LIST.page_size;
    adminStatus.value = null;
  }

  async function fetchPublic(params: ListPublicMomentsParams = {}) {
    publicLoading.value = true;
    try {
      const page = params.page ?? publicPage.value;
      const page_size = params.page_size ?? publicPageSize.value;
      const tag = params.tag !== undefined ? params.tag : publicActiveTag.value;
      const data = await momentsGateway.listPublic({
        page,
        page_size,
        tag: tag ?? undefined,
      });
      publicList.value = data.moments;
      publicTotal.value = data.total;
      publicPage.value = data.page;
      publicPageSize.value = data.page_size;
      publicActiveTag.value = tag ?? null;
      return data;
    } finally {
      publicLoading.value = false;
    }
  }

  async function fetchAdmin(params: ListAdminMomentsParams = {}) {
    adminLoading.value = true;
    try {
      const page = params.page ?? adminPage.value;
      const page_size = params.page_size ?? adminPageSize.value;
      const status =
        params.status !== undefined ? params.status : adminStatus.value;
      const data = await momentsGateway.listAdmin({
        page,
        page_size,
        status: status ?? undefined,
      });
      adminList.value = data.moments;
      adminTotal.value = data.total;
      adminPage.value = data.page;
      adminPageSize.value = data.page_size;
      adminStatus.value = status ?? null;
      return data;
    } finally {
      adminLoading.value = false;
    }
  }

  async function fetchOne(id: string, admin = false) {
    const moment = admin
      ? await momentsGateway.getAdmin(id)
      : await momentsGateway.get(id);
    current.value = moment;
    return moment;
  }

  /**
   * 落库即返回新 Moment；列表回写由调用方（[[MomentComposer]]）触发刷新。
   * 不在此处写 `publicList` —— 那是耦合来源。
   */
  async function create(payload: MomentCreatePayload): Promise<Moment> {
    return await momentsGateway.create(payload);
  }

  /** 编辑：落库即返回；当前条目同步（用于 detailModal 立即反映）。 */
  async function update(
    id: string,
    payload: MomentUpdatePayload,
  ): Promise<Moment> {
    const moment = await momentsGateway.update(id, payload);
    if (current.value?.id === id) {
      current.value = moment;
    }
    return moment;
  }

  /** 软删除：从两侧列表剔除 + 清空 current（若指向该条）。 */
  async function remove(id: string): Promise<void> {
    await momentsGateway.remove(id);
    publicList.value = publicList.value.filter((m) => m.id !== id);
    adminList.value = adminList.value.filter((m) => m.id !== id);
    if (current.value?.id === id) {
      current.value = null;
    }
  }

  return {
    // state — public
    publicList,
    publicTotal,
    publicPage,
    publicPageSize,
    publicActiveTag,
    publicLoading,
    // state — admin
    adminList,
    adminTotal,
    adminPage,
    adminPageSize,
    adminStatus,
    adminLoading,
    // state — current
    current,
    // actions
    resetPublic,
    resetAdmin,
    fetchPublic,
    fetchAdmin,
    fetchOne,
    create,
    update,
    remove,
  };
});
