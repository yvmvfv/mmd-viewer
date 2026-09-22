export interface FloorSettings {
  size: number; // m, 正方形
  color: string;
  visible: boolean;
}

export type LightPattern = "standard";

export interface AppSettings {
  background: string; // #000000
  floor: FloorSettings;
  shadows: boolean;
  shadowDarkness: number; // 0-1
  lightPattern: LightPattern;
  lightIntensity: number;
  lightAzimuth: number; // 0-360度
  lightElevation: number; // 10-85度
  transparentBg: boolean;
}

export const defaultSettings: AppSettings = {
  background: "#000000",
  floor: { size: 200, color: "#ffffff", visible: true },
  shadows: true,
  shadowDarkness: 0.6,
  lightPattern: "standard",
  lightIntensity: 1.0,
  lightAzimuth: 32,
  lightElevation: 59,
  transparentBg: false,
};
