/**
 * Gestionnaire d'indicateurs visuels pour l'extension
 * Fournit des animations et feedbacks visuels lors des interactions
 */

export class VisualIndicatorManager {
  private static instance: VisualIndicatorManager;
  private activeIndicators: Map<string, HTMLElement> = new Map();
  private indicatorCounter = 0;

  static getInstance(): VisualIndicatorManager {
    if (!VisualIndicatorManager.instance) {
      VisualIndicatorManager.instance = new VisualIndicatorManager();
    }
    return VisualIndicatorManager.instance;
  }

  /**
   * Affiche un indicateur de clic circulaire animé
   */
  showClickIndicator(x: number, y: number, element?: Element): void {
    const indicatorId = `click-indicator-${++this.indicatorCounter}`;

    // Créer l'élément indicateur
    const indicator = document.createElement("div");
    indicator.id = indicatorId;
    indicator.className = "action-capture-click-indicator";

    // Styles CSS pour l'animation
    Object.assign(indicator.style, {
      position: "fixed",
      left: `${x}px`,
      top: `${y}px`,
      width: "20px",
      height: "20px",
      borderRadius: "50%",
      border: "3px solid #3b82f6",
      backgroundColor: "rgba(59, 130, 246, 0.2)",
      pointerEvents: "none",
      zIndex: "999999",
      transform: "translate(-50%, -50%)",
      animation: "action-capture-click-pulse 0.6s ease-out forwards",
      boxShadow: "0 0 0 0 rgba(59, 130, 246, 0.7)",
    });

    // Ajouter les styles CSS si pas déjà présents
    this.ensureStyles();

    // Ajouter au DOM
    document.body.appendChild(indicator);
    this.activeIndicators.set(indicatorId, indicator);

    // Supprimer après l'animation
    setTimeout(() => {
      this.removeIndicator(indicatorId);
    }, 600);

    // Surbrillance de l'élément cliqué (optionnel)
    if (element) {
      this.highlightElement(element);
    }
  }

  /**
   * Affiche un indicateur de saisie
   */
  showInputIndicator(element: Element): void {
    const indicatorId = `input-indicator-${++this.indicatorCounter}`;

    const indicator = document.createElement("div");
    indicator.id = indicatorId;
    indicator.className = "action-capture-input-indicator";

    const rect = element.getBoundingClientRect();

    Object.assign(indicator.style, {
      position: "fixed",
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      border: "2px solid #10b981",
      backgroundColor: "rgba(16, 185, 129, 0.1)",
      pointerEvents: "none",
      zIndex: "999998",
      borderRadius: "4px",
      animation: "action-capture-input-glow 0.8s ease-out forwards",
    });

    this.ensureStyles();
    document.body.appendChild(indicator);
    this.activeIndicators.set(indicatorId, indicator);

    setTimeout(() => {
      this.removeIndicator(indicatorId);
    }, 800);
  }

  /**
   * Affiche un indicateur de défilement
   */
  showScrollIndicator(direction: "up" | "down"): void {
    const indicatorId = `scroll-indicator-${++this.indicatorCounter}`;

    const indicator = document.createElement("div");
    indicator.id = indicatorId;
    indicator.className = "action-capture-scroll-indicator";

    const icon = direction === "up" ? "↑" : "↓";

    Object.assign(indicator.style, {
      position: "fixed",
      right: "20px",
      top: direction === "up" ? "20px" : "auto",
      bottom: direction === "down" ? "20px" : "auto",
      width: "40px",
      height: "40px",
      borderRadius: "50%",
      backgroundColor: "#f59e0b",
      color: "white",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "20px",
      fontWeight: "bold",
      pointerEvents: "none",
      zIndex: "999997",
      animation: "action-capture-scroll-bounce 1s ease-out forwards",
      boxShadow: "0 4px 12px rgba(245, 158, 11, 0.4)",
    });

    indicator.textContent = icon;
    this.ensureStyles();
    document.body.appendChild(indicator);
    this.activeIndicators.set(indicatorId, indicator);

    setTimeout(() => {
      this.removeIndicator(indicatorId);
    }, 1000);
  }

  /**
   * Met en surbrillance un élément
   */
  private highlightElement(element: Element): void {
    const originalOutline = (element as HTMLElement).style.outline;
    const originalBoxShadow = (element as HTMLElement).style.boxShadow;

    (element as HTMLElement).style.outline = "2px solid #3b82f6";
    (element as HTMLElement).style.boxShadow =
      "0 0 0 4px rgba(59, 130, 246, 0.2)";

    setTimeout(() => {
      (element as HTMLElement).style.outline = originalOutline;
      (element as HTMLElement).style.boxShadow = originalBoxShadow;
    }, 300);
  }

  /**
   * Supprime un indicateur
   */
  private removeIndicator(indicatorId: string): void {
    const indicator = this.activeIndicators.get(indicatorId);
    if (indicator && indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
      this.activeIndicators.delete(indicatorId);
    }
  }

  /**
   * S'assure que les styles CSS sont présents
   */
  private ensureStyles(): void {
    if (document.getElementById("action-capture-styles")) return;

    const style = document.createElement("style");
    style.id = "action-capture-styles";
    style.textContent = `
      @keyframes action-capture-click-pulse {
        0% {
          transform: translate(-50%, -50%) scale(0.8);
          opacity: 1;
          box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
        }
        50% {
          transform: translate(-50%, -50%) scale(1.2);
          opacity: 0.8;
          box-shadow: 0 0 0 10px rgba(59, 130, 246, 0.3);
        }
        100% {
          transform: translate(-50%, -50%) scale(1.5);
          opacity: 0;
          box-shadow: 0 0 0 20px rgba(59, 130, 246, 0);
        }
      }

      @keyframes action-capture-input-glow {
        0% {
          opacity: 0.8;
          transform: scale(1);
        }
        50% {
          opacity: 1;
          transform: scale(1.02);
        }
        100% {
          opacity: 0;
          transform: scale(1.05);
        }
      }

      @keyframes action-capture-scroll-bounce {
        0% {
          transform: translateY(0) scale(0.8);
          opacity: 0;
        }
        20% {
          transform: translateY(-10px) scale(1.1);
          opacity: 1;
        }
        40% {
          transform: translateY(0) scale(1);
          opacity: 1;
        }
        60% {
          transform: translateY(-5px) scale(1.05);
          opacity: 1;
        }
        100% {
          transform: translateY(0) scale(1);
          opacity: 0;
        }
      }

      /* Styles pour éviter les conflits */
      .action-capture-click-indicator,
      .action-capture-input-indicator,
      .action-capture-scroll-indicator {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        box-sizing: border-box !important;
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Nettoie tous les indicateurs actifs
   */
  cleanup(): void {
    this.activeIndicators.forEach((indicator, id) => {
      this.removeIndicator(id);
    });
  }

  /**
   * Affiche un indicateur d'erreur
   */
  showErrorIndicator(message: string, x?: number, y?: number): void {
    const indicatorId = `error-indicator-${++this.indicatorCounter}`;

    const indicator = document.createElement("div");
    indicator.id = indicatorId;
    indicator.className = "action-capture-error-indicator";

    Object.assign(indicator.style, {
      position: "fixed",
      left: x ? `${x}px` : "50%",
      top: y ? `${y}px` : "20px",
      transform: x && y ? "translate(-50%, -50%)" : "translateX(-50%)",
      backgroundColor: "#ef4444",
      color: "white",
      padding: "8px 12px",
      borderRadius: "6px",
      fontSize: "12px",
      fontWeight: "500",
      pointerEvents: "none",
      zIndex: "999999",
      animation: "action-capture-error-shake 0.5s ease-out forwards",
      boxShadow: "0 4px 12px rgba(239, 68, 68, 0.4)",
      maxWidth: "300px",
      wordWrap: "break-word",
    });

    indicator.textContent = message;
    this.ensureErrorStyles();
    document.body.appendChild(indicator);
    this.activeIndicators.set(indicatorId, indicator);

    setTimeout(() => {
      this.removeIndicator(indicatorId);
    }, 3000);
  }

  /**
   * Styles pour les erreurs
   */
  private ensureErrorStyles(): void {
    if (document.getElementById("action-capture-error-styles")) return;

    const style = document.createElement("style");
    style.id = "action-capture-error-styles";
    style.textContent = `
      @keyframes action-capture-error-shake {
        0%, 100% { transform: translateX(-50%); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-52%); }
        20%, 40%, 60%, 80% { transform: translateX(-48%); }
      }
    `;

    document.head.appendChild(style);
  }
}
