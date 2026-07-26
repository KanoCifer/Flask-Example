import { describe, it, expect, beforeEach } from 'vitest';
import { useVisitorCountStore } from '../visitorCountStore';

describe('visitorCountStore', () => {
  beforeEach(() => {
    useVisitorCountStore.setState({
      count: 0,
      connectionDelay: 0,
      isConnected: false,
      sendPing: null,
    });
  });

  it('初始状态', () => {
    const state = useVisitorCountStore.getState();
    expect(state.count).toBe(0);
    expect(state.connectionDelay).toBe(0);
    expect(state.isConnected).toBe(false);
    expect(state.sendPing).toBeNull();
  });

  it('setCount 更新 count', () => {
    useVisitorCountStore.getState().setCount(42);
    expect(useVisitorCountStore.getState().count).toBe(42);
  });

  it('setConnected 更新连接状态', () => {
    useVisitorCountStore.getState().setConnected(true);
    expect(useVisitorCountStore.getState().isConnected).toBe(true);
  });

  it('setConnectionDelay 更新延迟', () => {
    useVisitorCountStore.getState().setConnectionDelay(150);
    expect(useVisitorCountStore.getState().connectionDelay).toBe(150);
  });

  it('setSendPing 存储 ping 函数', () => {
    const ping = () => {};
    useVisitorCountStore.getState().setSendPing(ping);
    expect(useVisitorCountStore.getState().sendPing).toBe(ping);

    useVisitorCountStore.getState().setSendPing(null);
    expect(useVisitorCountStore.getState().sendPing).toBeNull();
  });
});
