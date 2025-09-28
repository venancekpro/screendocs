import type { PlasmoCSConfig } from "plasmo";
import type { UserAction } from "~src/types";
import { SecurityManager } from "~src/utils/security";
import { SelectorGenerator } from "~src/utils/selectors";
import { StorageManager } from "~src/utils/storage";

// Configuration Plasmo pour le content script
export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false,
  run_at: "document_end",
};

// Content script pour capturer les actions utilisateur
class ActionCapture {
  private isRecording = false;
  private sessionId: string | null = null;
  private actionCounter = 0;

  constructor() {
    this.init();
  }

  private async init() {
    try {
      // Écouter les messages du popup/background
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log("📨 Message reçu dans content script:", message);
        this.handleMessage(message, sendResponse);
        return true; // Réponse asynchrone
      });

      // Vérifier si une session est en cours
      const currentSession = await StorageManager.getCurrentSession();
      console.log("📊 Session actuelle trouvée:", currentSession);
      if (currentSession?.isRecording) {
        console.log("🔄 Reprise de l'enregistrement de la session:", currentSession.id);
        this.startRecording(currentSession.id);
      }

      console.log(
        "🟢 Content script ActionCapture initialisé sur:",
        window.location.href
      );
    } catch (error) {
      if (error instanceof Error && error.message?.includes("Extension context invalidated")) {
        console.log("Extension context invalidated during initialization");
        return;
      }
      console.error("Error initializing ActionCapture:", error);
    }
  }

  private async handleMessage(message: any, sendResponse: Function) {
    console.log("🔧 Traitement du message:", message.type, message);
    switch (message.type) {
      case "START_RECORDING":
        console.log("▶️ Démarrage de l'enregistrement pour session:", message.sessionId);
        await this.startRecording(message.sessionId);
        sendResponse({ success: true });
        break;

      case "STOP_RECORDING":
        console.log("⏹️ Arrêt de l'enregistrement");
        await this.stopRecording();
        sendResponse({ success: true });
        break;

      case "GET_STATUS":
        const status = {
          isRecording: this.isRecording,
          sessionId: this.sessionId,
        };
        console.log("📊 Statut demandé:", status);
        sendResponse(status);
        break;
    }
  }

  private async startRecording(sessionId: string) {
    this.isRecording = true;
    this.sessionId = sessionId;
    this.actionCounter = 0;

    // Ajouter les event listeners
    this.addEventListeners();

    console.log("🔴 Enregistrement démarré pour session:", sessionId);
    console.log("🎯 Event listeners ajoutés, prêt à capturer les actions");
  }

  private async stopRecording() {
    this.isRecording = false;
    this.sessionId = null;

    // Retirer les event listeners
    this.removeEventListeners();

    console.log("⏹️ Enregistrement arrêté");
  }

  private addEventListeners() {
    document.addEventListener("click", this.handleClick, true);
    document.addEventListener("input", this.handleInput, true);
    document.addEventListener("scroll", this.handleScroll, { passive: true });

    // Navigation (changement d'URL)
    window.addEventListener("popstate", this.handleNavigation);
  }

  private removeEventListeners() {
    document.removeEventListener("click", this.handleClick, true);
    document.removeEventListener("input", this.handleInput, true);
    document.removeEventListener("scroll", this.handleScroll);
    window.removeEventListener("popstate", this.handleNavigation);
  }

  private handleClick = async (event: MouseEvent) => {
    console.log("👆 Click détecté", {
      isRecording: this.isRecording,
      sessionId: this.sessionId,
      target: event.target
    });

    if (!this.isRecording || !this.sessionId) {
      console.log("❌ Click ignoré - pas d'enregistrement en cours");
      return;
    }

    const target = event.target as Element;
    if (!target) {
      console.log("❌ Click ignoré - pas de target");
      return;
    }

    // Ignorer les clics sur l'extension elle-même
    if (target.closest('[data-extension="action-capture"]')) {
      console.log("❌ Click ignoré - clic sur l'extension");
      return;
    }

    console.log("✅ Click valide - création de l'action");

    const action: UserAction = {
      id: `${this.sessionId}_${++this.actionCounter}`,
      type: "click",
      timestamp: Date.now(),
      element: SelectorGenerator.getElementInfo(target),
      description: this.generateClickDescription(target),
    };

    console.log("💾 Sauvegarde de l'action:", action);
    await this.saveAction(action);
    await this.requestScreenshot(action.id);
  };

  private handleInput = async (event: Event) => {
    if (!this.isRecording || !this.sessionId) return;

    const target = event.target as HTMLInputElement;
    if (!target) return;

    // Utiliser SecurityManager pour obtenir une valeur sécurisée
    const safeValue = SecurityManager.getSafeElementValue(target);
    const isSensitive = SecurityManager.isSensitiveElement(target);

    const action: UserAction = {
      id: `${this.sessionId}_${++this.actionCounter}`,
      type: "input",
      timestamp: Date.now(),
      element: {
        ...SelectorGenerator.getElementInfo(target),
        value: safeValue,
      },
      description: this.generateInputDescription(target, isSensitive),
    };

    await this.saveAction(action);
    await this.requestScreenshot(action.id);
  };

  private handleScroll = async (event: Event) => {
    if (!this.isRecording || !this.sessionId) return;

    // Throttle scroll events (max 1 par seconde)
    if (this.lastScrollTime && Date.now() - this.lastScrollTime < 1000) return;
    this.lastScrollTime = Date.now();

    const action: UserAction = {
      id: `${this.sessionId}_${++this.actionCounter}`,
      type: "scroll",
      timestamp: Date.now(),
      element: {
        tagName: "window",
        selector: "window",
        text: `Scroll position: ${window.scrollY}px`,
        value: window.scrollY.toString(),
        attributes: {},
      },
      description: `Défilement vers ${
        window.scrollY > (this.lastScrollY || 0) ? "le bas" : "le haut"
      }`,
    };

    this.lastScrollY = window.scrollY;
    await this.saveAction(action);
    await this.requestScreenshot(action.id);
  };

  private lastScrollTime = 0;
  private lastScrollY = 0;

  private handleNavigation = async (event: PopStateEvent) => {
    if (!this.isRecording || !this.sessionId) return;

    const action: UserAction = {
      id: `${this.sessionId}_${++this.actionCounter}`,
      type: "navigation",
      timestamp: Date.now(),
      element: {
        tagName: "window",
        selector: "window",
        text: window.location.href,
        value: window.location.href,
        attributes: {},
      },
      description: `Navigation vers ${window.location.href}`,
    };

    await this.saveAction(action);
    await this.requestScreenshot(action.id);
  };

  private generateClickDescription(element: Element): string {
    const tagName = element.tagName.toLowerCase();
    const text = element.textContent?.trim();

    if (tagName === "button") {
      return `Cliquer sur le bouton "${text || "sans texte"}"`;
    } else if (tagName === "a") {
      return `Cliquer sur le lien "${text || "sans texte"}"`;
    } else if (element.getAttribute("role") === "button") {
      return `Cliquer sur l'élément bouton "${text || "sans texte"}"`;
    } else {
      return `Cliquer sur ${tagName}${text ? ` "${text}"` : ""}`;
    }
  }

  private generateInputDescription(
    element: HTMLInputElement,
    isSensitive: boolean
  ): string {
    const placeholder = element.placeholder;
    const label = element.labels?.[0]?.textContent;
    const fieldName = label || placeholder || element.name || "champ";

    if (isSensitive) {
      return `Saisir des données dans "${fieldName}" (données sensibles masquées)`;
    } else {
      const safeValue = SecurityManager.getSafeElementValue(element);
      return `Saisir "${safeValue}" dans "${fieldName}"`;
    }
  }

  private async saveAction(action: UserAction) {
    const session = await StorageManager.getCurrentSession();
    if (!session) return;

    session.actions.push(action);
    await StorageManager.saveSession(session);

    console.log("💾 Action sauvegardée:", action.type, action.description);
  }

  private async requestScreenshot(actionId: string) {
    try {
      // Demander une capture d'écran au background script
      await chrome.runtime.sendMessage({
        type: "TAKE_SCREENSHOT",
        actionId: actionId,
      });
    } catch (error) {
      // Ignorer les erreurs de contexte d'extension
      if (error instanceof Error && error.message?.includes("Extension context invalidated")) {
        console.log("Extension context invalidated - screenshot request ignored");
      } else {
        console.error("Screenshot request failed:", error);
      }
    }
  }
}

// Initialiser la capture
new ActionCapture();
