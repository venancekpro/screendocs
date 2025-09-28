// Types pour l'extension de capture d'actions

export interface UserAction {
  id: string;
  type: "click" | "input" | "scroll" | "navigation";
  timestamp: number;
  element: {
    tagName: string;
    selector: string;
    text?: string;
    value?: string;
    attributes: Record<string, string>;
  };
  screenshot?: string; // base64
  description?: string;
}

export interface CaptureSession {
  id: string;
  title: string;
  url: string;
  startTime: number;
  endTime?: number;
  actions: UserAction[];
  isRecording: boolean;
}

export interface ExportOptions {
  format: "markdown" | "pdf" | "html";
  includeScreenshots: boolean;
  blurSensitiveData: boolean;
}

export interface StorageData {
  sessions: CaptureSession[];
  currentSession?: string;
  settings: {
    autoScreenshot: boolean;
    blurPasswords: boolean;
    captureScrolling: boolean;
  };
}
