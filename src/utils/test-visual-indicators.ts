/**
 * Script de test pour les indicateurs visuels
 * À utiliser dans la console du navigateur pour tester les fonctionnalités
 */

import { ErrorHandler } from "./error-handler";
import { VisualIndicatorManager } from "./visual-indicators";

// Fonction de test globale
(window as any).testVisualIndicators = () => {
  console.log("🧪 Test des indicateurs visuels...");

  const visualIndicator = VisualIndicatorManager.getInstance();
  const errorHandler = ErrorHandler.getInstance();

  // Test 1: Indicateur de clic
  console.log("1. Test indicateur de clic");
  visualIndicator.showClickIndicator(100, 100);

  // Test 2: Indicateur de saisie
  console.log("2. Test indicateur de saisie");
  const testInput = document.createElement("input");
  testInput.style.position = "fixed";
  testInput.style.left = "200px";
  testInput.style.top = "200px";
  testInput.style.width = "200px";
  testInput.style.height = "30px";
  testInput.style.border = "1px solid #ccc";
  document.body.appendChild(testInput);
  visualIndicator.showInputIndicator(testInput);

  // Test 3: Indicateur de défilement
  console.log("3. Test indicateur de défilement");
  visualIndicator.showScrollIndicator("down");
  setTimeout(() => {
    visualIndicator.showScrollIndicator("up");
  }, 1000);

  // Test 4: Indicateur d'erreur
  console.log("4. Test indicateur d'erreur");
  setTimeout(() => {
    visualIndicator.showErrorIndicator("Test d'erreur", 300, 300);
  }, 2000);

  // Test 5: Gestionnaire d'erreurs
  console.log("5. Test gestionnaire d'erreurs");
  setTimeout(() => {
    errorHandler.handleError("Test d'erreur avec contexte", {
      component: "TestComponent",
      action: "testAction",
    });
  }, 3000);

  // Nettoyage après 5 secondes
  setTimeout(() => {
    if (testInput.parentNode) {
      testInput.parentNode.removeChild(testInput);
    }
    visualIndicator.cleanup();
    console.log("✅ Tests terminés - nettoyage effectué");
  }, 5000);

  console.log("🎯 Tests lancés - observez les indicateurs visuels");
};

// Fonction de test des sélecteurs
(window as any).testSelectors = () => {
  console.log("🧪 Test des sélecteurs...");

  // Créer un élément de test
  const testElement = document.createElement("button");
  testElement.id = "test-button";
  testElement.className = "btn btn-primary";
  testElement.textContent = "Bouton de test";
  testElement.setAttribute("data-testid", "test-button");
  testElement.style.position = "fixed";
  testElement.style.left = "400px";
  testElement.style.top = "400px";
  testElement.style.padding = "10px";
  testElement.style.border = "1px solid #ccc";
  testElement.style.backgroundColor = "#007bff";
  testElement.style.color = "white";
  document.body.appendChild(testElement);

  // Tester les sélecteurs
  const { SelectorGenerator } = require("./selectors");

  console.log(
    "Sélecteur généré:",
    SelectorGenerator.generateSelector(testElement)
  );
  console.log(
    "Sélecteur sécurisé:",
    SelectorGenerator.generateSafeSelector(testElement)
  );
  console.log("Info élément:", SelectorGenerator.getElementInfo(testElement));

  // Nettoyage
  setTimeout(() => {
    if (testElement.parentNode) {
      testElement.parentNode.removeChild(testElement);
    }
    console.log("✅ Test sélecteurs terminé");
  }, 3000);
};

console.log("🚀 Scripts de test chargés:");
console.log("- testVisualIndicators() : Test des indicateurs visuels");
console.log("- testSelectors() : Test des sélecteurs CSS");
