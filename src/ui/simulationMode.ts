import { useProjectStore } from '../store/projectStore.ts';
import { useSimStore } from '../store/simStore.ts';
import { useUiStore } from '../store/uiStore.ts';

/** In den Simulationsmodus wechseln: wie im Original starten dabei alle Geräte neu. */
export function enterSimulation(): void {
  useUiStore.getState().setMode('simulation');
  void useSimStore.getState().start(useProjectStore.getState().project);
}

/** Zurück in den Entwurfsmodus: Simulation anhalten, Tabellen verwerfen. */
export function enterDesign(): void {
  useSimStore.getState().stop();
  useUiStore.getState().setMode('design');
}
