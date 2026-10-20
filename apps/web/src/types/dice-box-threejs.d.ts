declare module '@3d-dice/dice-box-threejs' {
  interface DiceBoxColorset {
    name: string;
    background: string;
    foreground: string;
    outline?: string;
    texture?: string;
    material?: 'none' | 'metal' | 'wood' | 'glass' | 'plastic';
  }

  interface DiceBoxConfig {
    framerate?: number;
    sounds?: boolean;
    shadows?: boolean;
    theme_customColorset?: DiceBoxColorset | null;
    theme_colorset?: string;
    theme_texture?: string;
    theme_material?: 'none' | 'metal' | 'wood' | 'glass' | 'plastic';
    gravity_multiplier?: number;
    light_intensity?: number;
    baseScale?: number;
    strength?: number;
  }

  export default class DiceBox {
    constructor(selector: string, config?: DiceBoxConfig);
    initialize(): Promise<void>;
    updateConfig(config: DiceBoxConfig): Promise<void>;
    roll(notation: string): Promise<unknown>;
    clearDice(): void;
  }
}
