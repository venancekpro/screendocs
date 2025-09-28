/**
 * Gestionnaire d'erreurs centralisé pour l'extension
 * Fournit une gestion robuste des erreurs avec indicateurs visuels
 */

import { VisualIndicatorManager } from "./visual-indicators";

export interface ErrorContext {
  component?: string;
  action?: string;
  sessionId?: string;
  element?: Element;
  additionalInfo?: Record<string, any>;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private visualIndicator: VisualIndicatorManager;
  private errorCount = 0;
  private maxErrorsPerSession = 10;

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  constructor() {
    this.visualIndicator = VisualIndicatorManager.getInstance();
  }

  /**
   * Gère une erreur avec contexte et indicateur visuel
   */
  handleError(error: Error | string, context: ErrorContext = {}): void {
    this.errorCount++;

    const errorMessage = typeof error === "string" ? error : error.message;
    const fullContext = {
      ...context,
      errorCount: this.errorCount,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    };

    // Log de l'erreur
    console.error("🚨 Erreur Action Capture:", {
      message: errorMessage,
      context: fullContext,
      stack: typeof error === "object" ? error.stack : undefined,
    });

    // Afficher un indicateur visuel si pas trop d'erreurs
    if (this.errorCount <= this.maxErrorsPerSession) {
      this.showErrorIndicator(errorMessage, context);
    }

    // Gestion spécifique par type d'erreur
    this.handleSpecificError(error, context);
  }

  /**
   * Gère les erreurs spécifiques
   */
  private handleSpecificError(
    error: Error | string,
    context: ErrorContext
  ): void {
    const errorMessage = typeof error === "string" ? error : error.message;

    // Erreurs de contexte d'extension
    if (errorMessage.includes("Extension context invalidated")) {
      this.handleExtensionContextError(context);
      return;
    }

    // Erreurs de sélecteur CSS
    if (
      errorMessage.includes("not a valid selector") ||
      errorMessage.includes("querySelectorAll")
    ) {
      this.handleSelectorError(context);
      return;
    }

    // Erreurs de clés React dupliquées
    if (errorMessage.includes("Encountered two children with the same key")) {
      this.handleDuplicateKeyError(context);
      return;
    }

    // Erreurs WebSocket
    if (
      errorMessage.includes("WebSocket") ||
      errorMessage.includes("connection")
    ) {
      this.handleConnectionError(context);
      return;
    }

    // Erreur générique
    this.handleGenericError(errorMessage, context);
  }

  /**
   * Gère les erreurs de contexte d'extension
   */
  private handleExtensionContextError(context: ErrorContext): void {
    const message = "Extension rechargée - redémarrez l'enregistrement";
    this.visualIndicator.showErrorIndicator(message, window.innerWidth / 2, 50);

    // Nettoyer les ressources
    this.cleanup();
  }

  /**
   * Gère les erreurs de sélecteur CSS
   */
  private handleSelectorError(context: ErrorContext): void {
    const message =
      "Erreur de sélection d'élément - utilisation d'un sélecteur alternatif";
    this.visualIndicator.showErrorIndicator(message, window.innerWidth / 2, 50);
  }

  /**
   * Gère les erreurs de clés dupliquées
   */
  private handleDuplicateKeyError(context: ErrorContext): void {
    const message = "Erreur d'affichage - actualisation recommandée";
    this.visualIndicator.showErrorIndicator(message, window.innerWidth / 2, 50);

    // Suggérer une actualisation après un délai
    setTimeout(() => {
      if (
        confirm(
          "L'extension rencontre des erreurs d'affichage. Voulez-vous actualiser la page ?"
        )
      ) {
        window.location.reload();
      }
    }, 2000);
  }

  /**
   * Gère les erreurs de connexion
   */
  private handleConnectionError(context: ErrorContext): void {
    const message = "Problème de connexion - vérifiez votre réseau";
    this.visualIndicator.showErrorIndicator(message, window.innerWidth / 2, 50);
  }

  /**
   * Gère les erreurs génériques
   */
  private handleGenericError(
    errorMessage: string,
    context: ErrorContext
  ): void {
    const shortMessage =
      errorMessage.length > 50
        ? errorMessage.substring(0, 47) + "..."
        : errorMessage;

    this.visualIndicator.showErrorIndicator(
      shortMessage,
      window.innerWidth / 2,
      50
    );
  }

  /**
   * Affiche un indicateur d'erreur avec positionnement intelligent
   */
  private showErrorIndicator(message: string, context: ErrorContext): void {
    let x = window.innerWidth / 2;
    let y = 50;

    // Positionner l'indicateur près de l'élément si disponible
    if (context.element) {
      const rect = context.element.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top - 10;

      // S'assurer que l'indicateur reste visible
      if (y < 20) y = rect.bottom + 10;
      if (x < 100) x = 100;
      if (x > window.innerWidth - 100) x = window.innerWidth - 100;
    }

    this.visualIndicator.showErrorIndicator(message, x, y);
  }

  /**
   * Nettoie les ressources en cas d'erreur
   */
  private cleanup(): void {
    try {
      this.visualIndicator.cleanup();
    } catch (error) {
      console.warn("Erreur lors du nettoyage:", error);
    }
  }

  /**
   * Réinitialise le compteur d'erreurs
   */
  resetErrorCount(): void {
    this.errorCount = 0;
  }

  /**
   * Vérifie si trop d'erreurs ont été rencontrées
   */
  hasTooManyErrors(): boolean {
    return this.errorCount >= this.maxErrorsPerSession;
  }

  /**
   * Gère les erreurs de manière silencieuse (sans indicateur visuel)
   */
  handleSilentError(error: Error | string, context: ErrorContext = {}): void {
    const errorMessage = typeof error === "string" ? error : error.message;

    console.warn("⚠️ Erreur silencieuse:", {
      message: errorMessage,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Gère les erreurs avec retry automatique
   */
  async handleErrorWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T | null> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === maxRetries) {
          this.handleError(lastError, {
            ...context,
            additionalInfo: { attempts: maxRetries, finalAttempt: true },
          });
          return null;
        }

        // Attendre avant de réessayer
        await new Promise((resolve) => setTimeout(resolve, delay * attempt));

        console.log(
          `🔄 Tentative ${attempt + 1}/${maxRetries} après erreur:`,
          lastError.message
        );
      }
    }

    return null;
  }
}
