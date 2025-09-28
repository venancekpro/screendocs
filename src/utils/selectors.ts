// Utilitaires pour générer des sélecteurs robustes

export class SelectorGenerator {
  static generateSelector(element: Element): string {
    // Priorité : data-testid > id > aria-label > classe + texte > xpath

    // 1. data-testid
    const testId = element.getAttribute("data-testid");
    if (testId) {
      return `[data-testid="${testId}"]`;
    }

    // 2. ID unique
    const id = element.id;
    if (id && document.querySelectorAll(`#${id}`).length === 1) {
      return `#${id}`;
    }

    // 3. aria-label
    const ariaLabel = element.getAttribute("aria-label");
    if (ariaLabel) {
      return `[aria-label="${ariaLabel}"]`;
    }

    // 4. Combinaison classe + texte (sans :contains qui n'est pas CSS valide)
    const className = element.className;
    const text = element.textContent?.trim();
    if (className && text && text.length < 50) {
      // Utiliser une classe CSS valide au lieu de :contains
      const firstClass = className.split(" ")[0];
      if (firstClass && this.isValidCSSClass(firstClass)) {
        return `.${firstClass}`;
      }
    }

    // 5. Fallback XPath
    return this.generateXPath(element);
  }

  private static generateXPath(element: Element): string {
    if (element === document.body) {
      return "/html/body";
    }

    let path = "";
    let current = element;

    while (current && current !== document.body) {
      const tagName = current.tagName.toLowerCase();
      const siblings = Array.from(current.parentElement?.children || []).filter(
        (el) => el.tagName === current.tagName
      );

      if (siblings.length === 1) {
        path = `/${tagName}${path}`;
      } else {
        const index = siblings.indexOf(current) + 1;
        path = `/${tagName}[${index}]${path}`;
      }

      current = current.parentElement;
    }

    return `/html/body${path}`;
  }

  static getElementInfo(element: Element) {
    return {
      tagName: element.tagName.toLowerCase(),
      selector: this.generateSelector(element),
      text: element.textContent?.trim() || "",
      value: (element as HTMLInputElement).value || "",
      attributes: this.getRelevantAttributes(element),
    };
  }

  private static getRelevantAttributes(
    element: Element
  ): Record<string, string> {
    const relevantAttrs = [
      "id",
      "class",
      "name",
      "type",
      "placeholder",
      "aria-label",
      "data-testid",
    ];
    const attrs: Record<string, string> = {};

    relevantAttrs.forEach((attr) => {
      const value = element.getAttribute(attr);
      if (value) {
        attrs[attr] = value;
      }
    });

    return attrs;
  }

  /**
   * Valide qu'une classe CSS est valide
   */
  private static isValidCSSClass(className: string): boolean {
    // Vérifier que la classe ne contient que des caractères valides
    return /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(className);
  }

  /**
   * Valide qu'un sélecteur CSS est valide
   */
  static isValidSelector(selector: string): boolean {
    try {
      // Tenter de créer un élément avec le sélecteur
      document.querySelector(selector);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Génère un sélecteur sécurisé avec validation
   */
  static generateSafeSelector(element: Element): string {
    const selector = this.generateSelector(element);

    // Si le sélecteur n'est pas valide, utiliser un fallback
    if (!this.isValidSelector(selector)) {
      console.warn("⚠️ Sélecteur invalide généré:", selector);
      return this.generateXPath(element);
    }

    return selector;
  }
}
