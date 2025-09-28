import type { CaptureSession, StorageData } from "~src/types";

// Utilitaires pour le stockage Chrome
export class StorageManager {
  private static readonly STORAGE_KEY = "actionCaptureData";

  static async getData(): Promise<StorageData> {
    const result = await chrome.storage.local.get(this.STORAGE_KEY);
    return (
      result[this.STORAGE_KEY] || {
        sessions: [],
        settings: {
          autoScreenshot: true,
          blurPasswords: true,
          captureScrolling: true,
        },
      }
    );
  }

  static async saveData(data: StorageData): Promise<void> {
    await chrome.storage.local.set({
      [this.STORAGE_KEY]: data,
    });
  }

  static async getCurrentSession(): Promise<CaptureSession | null> {
    const data = await this.getData();
    if (!data.currentSession) return null;

    return data.sessions.find((s) => s.id === data.currentSession) || null;
  }

  static async saveSession(session: CaptureSession): Promise<void> {
    const data = await this.getData();
    const existingIndex = data.sessions.findIndex((s) => s.id === session.id);

    if (existingIndex >= 0) {
      data.sessions[existingIndex] = session;
    } else {
      data.sessions.push(session);
    }

    await this.saveData(data);
  }

  static async setCurrentSession(sessionId: string | null): Promise<void> {
    const data = await this.getData();
    data.currentSession = sessionId || undefined;
    await this.saveData(data);
  }

  static async deleteSession(sessionId: string): Promise<void> {
    const data = await this.getData();

    // Supprimer la session de la liste
    data.sessions = data.sessions.filter((s) => s.id !== sessionId);

    // Si c'était la session courante, la désactiver
    if (data.currentSession === sessionId) {
      data.currentSession = undefined;
    }

    await this.saveData(data);
  }

  static async deleteAllSessions(): Promise<void> {
    const data = await this.getData();
    data.sessions = [];
    data.currentSession = undefined;
    await this.saveData(data);
  }
}
