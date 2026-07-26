// 设备（Device）领域类型

export type DeviceInput = {
  name: string;
  purchase_date: string;
  price: number;
  currency: string;
  notes?: string;
  status: 'active' | 'retired';
  reminder_config: unknown;
};

export type Device = DeviceInput & {
  id: number;
};
