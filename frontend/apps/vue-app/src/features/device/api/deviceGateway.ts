import { apiClient } from '@/api/request';

import type { Device, DeviceInput } from '@/features/device/types';

export interface DeviceGateway {
  getUserDevices: () => Promise<Device[]>;
  getUserGlobalConfig: () => Promise<{ config: Record<string, unknown> }>;
  getDeviceById: (device_id: number) => Promise<Device>;
  createDevice: (data: DeviceInput) => Promise<Device>;
  deleteDevice: (device_id: number) => Promise<void>;
  updateDevice: (
    device_id: number,
    data: Omit<DeviceInput, 'id'>,
  ) => Promise<Device>;
  updateDeviceStatus: (
    device_id: number,
    status: 'active' | 'retired',
  ) => Promise<Device>;
  updateDeviceReminderConfig: (
    device_id: number,
    reminder_config: unknown,
  ) => Promise<Device>;
  testNotification: (device_id: number) => Promise<void>;
}

export const deviceGateway: DeviceGateway = {
  async getUserDevices() {
    const res = await apiClient.get<{ data: { devices: Device[] } }>(
      'v2/device',
    );
    return res.data.data.devices;
  },

  async getUserGlobalConfig() {
    const res = await apiClient.get<{
      data: { config: Record<string, unknown> };
    }>('v2/subscriptions/global-config');
    return res.data.data;
  },

  async getDeviceById(device_id: number) {
    const res = await apiClient.get<{ data: Device }>(`v2/device/${device_id}`);
    return res.data.data;
  },

  async createDevice(data: DeviceInput) {
    const res = await apiClient.post<{ data: Device }>('v2/device', data);
    return res.data.data;
  },

  async deleteDevice(device_id: number) {
    await apiClient.delete(`v2/device/${device_id}`);
  },

  async updateDevice(device_id: number, data) {
    const res = await apiClient.put<{ data: Device }>(
      `v2/device/${device_id}`,
      {
        device_input: data,
      },
    );
    return res.data.data;
  },

  async updateDeviceStatus(device_id: number, status: 'active' | 'retired') {
    const res = await apiClient.patch<{ data: Device }>(
      `v2/device/${device_id}/status`,
      { status },
    );
    return res.data.data;
  },

  async updateDeviceReminderConfig(
    device_id: number,
    reminder_config: unknown,
  ) {
    const res = await apiClient.patch<{ data: Device }>(
      `v2/device/${device_id}/reminders`,
      {
        reminder_config,
      },
    );
    return res.data.data;
  },

  async testNotification(device_id: number) {
    await apiClient.post(`v2/device/${device_id}/test-notification`);
  },
};
