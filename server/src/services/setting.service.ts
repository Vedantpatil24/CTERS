import { prisma } from '../prisma';
import { DEFAULT_SETTINGS } from '../constants';

export class SettingService {
  static async get(key: string): Promise<string> {
    const setting = await prisma.setting.findUnique({ where: { key } });
    if (setting) return setting.value;
    return DEFAULT_SETTINGS[key] ?? '';
  }

  static async getNumber(key: string): Promise<number> {
    const val = await this.get(key);
    return Number(val) || 0;
  }

  static async getBoolean(key: string): Promise<boolean> {
    const val = await this.get(key);
    return val === 'true';
  }

  static async set(key: string, value: string, description?: string): Promise<void> {
    await prisma.setting.upsert({
      where: { key },
      update: { value, ...(description ? { description } : {}) },
      create: { key, value, description }
    });
  }

  static async getAll(): Promise<Record<string, string>> {
    const all = await prisma.setting.findMany();
    const map: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const item of all) {
      map[item.key] = item.value;
    }
    return map;
  }
}
