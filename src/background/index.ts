import type { CaptureSession } from "~src/types";
import { StorageManager } from "~src/utils/storage";

// Background script pour gérer les captures d'écran et la coordination
class BackgroundManager {
  constructor() {
    this.init();
  }

  private init() {
    // Écouter les messages des content scripts et popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Réponse asynchrone
    });

    // Écouter les changements d'onglets
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === "complete") {
        this.handleTabUpdate(tabId, tab);
      }
    });
  }

  private async handleMessage(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: Function
  ) {
    switch (message.type) {
      case "CREATE_SESSION":
        const session = await this.createSession(message.title, message.url);
        sendResponse({ session });
        break;

      case "START_RECORDING":
        await this.startRecording(message.sessionId);
        sendResponse({ success: true });
        break;

      case "STOP_RECORDING":
        await this.stopRecording();
        sendResponse({ success: true });
        break;

      case "TAKE_SCREENSHOT":
        await this.takeScreenshot(message.actionId, sender.tab?.id);
        sendResponse({ success: true });
        break;

      case "GET_SESSIONS":
        const data = await StorageManager.getData();
        sendResponse({ sessions: data.sessions });
        break;

      case "DELETE_SESSION":
        await StorageManager.deleteSession(message.sessionId);
        sendResponse({ success: true });
        break;

      case "DELETE_ALL_SESSIONS":
        await StorageManager.deleteAllSessions();
        sendResponse({ success: true });
        break;
    }
  }

  private async createSession(
    title: string,
    url: string
  ): Promise<CaptureSession> {
    const session: CaptureSession = {
      id: `session_${Date.now()}`,
      title: title || `Session ${new Date().toLocaleString()}`,
      url: url,
      startTime: Date.now(),
      actions: [],
      isRecording: false,
    };

    await StorageManager.saveSession(session);
    return session;
  }

  private async startRecording(sessionId: string) {
    console.log("🎬 Background: Démarrage de l'enregistrement pour session:", sessionId);

    // Marquer la session comme active
    await StorageManager.setCurrentSession(sessionId);

    // Mettre à jour le statut de la session
    const session = await StorageManager.getCurrentSession();
    if (session) {
      session.isRecording = true;
      session.startTime = Date.now();
      await StorageManager.saveSession(session);
      console.log("✅ Background: Session mise à jour:", session);
    }

    // Notifier l'onglet actif en priorité
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id && activeTab.url && !activeTab.url.startsWith("chrome://") && !activeTab.url.startsWith("chrome-extension://")) {
      await this.activateTabForRecording(activeTab.id, activeTab.url, sessionId);
    }

    // Ensuite notifier tous les autres onglets
    const allTabs = await chrome.tabs.query({});
    console.log("📋 Background: Nombre d'onglets trouvés:", allTabs.length);

    for (const tab of allTabs) {
      if (tab.id && tab.url && !tab.url.startsWith("chrome://") && !tab.url.startsWith("chrome-extension://") && tab.id !== activeTab?.id) {
        await this.activateTabForRecording(tab.id, tab.url, sessionId);
      }
    }
  }

  private async activateTabForRecording(tabId: number, tabUrl: string, sessionId: string) {
    try {
      console.log("📤 Background: Envoi du message START_RECORDING à l'onglet:", tabUrl);
      await chrome.tabs.sendMessage(tabId, {
        type: "START_RECORDING",
        sessionId: sessionId,
      });
      console.log("✅ Background: Message envoyé avec succès à l'onglet:", tabUrl);
    } catch (error) {
      console.log("⚠️ Background: Content script pas encore disponible pour:", tabUrl);
      console.log("💡 Background: L'onglet sera activé automatiquement lors du prochain rechargement");
    }
  }

  private async stopRecording() {
    const session = await StorageManager.getCurrentSession();
    if (session) {
      session.isRecording = false;
      session.endTime = Date.now();
      await StorageManager.saveSession(session);
    }

    await StorageManager.setCurrentSession(null);

    // Notifier tous les onglets d'arrêter l'enregistrement
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id && tab.url && !tab.url.startsWith("chrome://")) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            type: "STOP_RECORDING",
          });
        } catch (error) {
          // Ignorer les erreurs pour les onglets non accessibles
          console.log("Cannot contact tab:", tab.url, error instanceof Error ? error.message : error);
        }
      }
    }
  }

  private async takeScreenshot(actionId: string, tabId?: number) {
    if (!tabId) return;

    try {
      // Capturer l'onglet visible
      const dataUrl = await chrome.tabs.captureVisibleTab(undefined, {
        format: "png",
        quality: 80,
      });

      // Sauvegarder la capture avec l'action
      const session = await StorageManager.getCurrentSession();
      if (session) {
        const action = session.actions.find((a) => a.id === actionId);
        if (action) {
          action.screenshot = dataUrl;
          await StorageManager.saveSession(session);
        }
      }
    } catch (error) {
      console.error("Erreur capture d'écran:", error);
    }
  }

  private async handleTabUpdate(tabId: number, tab: chrome.tabs.Tab) {
    const session = await StorageManager.getCurrentSession();
    if (session?.isRecording && tab.url && !tab.url.startsWith("chrome://")) {
      // Le content script est automatiquement injecté par Plasmo
      // Notifier le content script de démarrer l'enregistrement
      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tabId, {
            type: "START_RECORDING",
            sessionId: session.id,
          });
        } catch (error) {
          console.log("Cannot contact new tab:", tab.url, error instanceof Error ? error.message : error);
        }
      }, 500); // Délai plus long pour laisser le temps au content script de se charger
    }
  }
}

// Initialiser le background manager
new BackgroundManager();
