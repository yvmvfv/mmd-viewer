import type { LightPattern } from "../../state/settings";
import type { SettingsStore } from "../../state/store";
import type { MenuItem } from "../menuRegistry";

export class AppearanceItem implements MenuItem {
  readonly id = "studio-settings";
  readonly title = "スタジオ設定";
  readonly icon = "⚙";
  constructor(private store: SettingsStore) {}
  render(host: HTMLElement): void {
    const s = this.store.get();
    const h = document.createElement("h3");
    h.textContent = "スタジオ設定";
    host.append(h);

    const patternLabel = document.createElement("p");
    patternLabel.textContent = "ライトパターン";
    const pattern = document.createElement("select");
    const opt = document.createElement("option");
    opt.value = "standard";
    opt.textContent = "標準";
    pattern.appendChild(opt);
    pattern.value = s.lightPattern;
    pattern.onchange = () => this.store.patch({ lightPattern: pattern.value as LightPattern });

    const colors = document.createElement("div");
    colors.className = "studio-grid";
    const bgWrap = document.createElement("label");
    bgWrap.textContent = "背景色";
    const bg = document.createElement("input");
    bg.type = "color";
    bg.value = s.background;
    bg.oninput = () => this.store.patch({ background: bg.value });
    bgWrap.appendChild(bg);
    const floorWrap = document.createElement("label");
    floorWrap.textContent = "床の色";
    const floorColor = document.createElement("input");
    floorColor.type = "color";
    floorColor.value = s.floor.color;
    floorColor.oninput = () => this.store.patch({ floor: { ...this.store.get().floor, color: floorColor.value } });
    floorWrap.appendChild(floorColor);
    colors.append(bgWrap, floorWrap);

    const floorLabel = document.createElement("label");
    floorLabel.className = "check-row";
    const floorCheck = document.createElement("input");
    floorCheck.type = "checkbox";
    floorCheck.checked = s.floor.visible;
    floorCheck.onchange = () =>
      this.store.patch({ floor: { ...this.store.get().floor, visible: floorCheck.checked } });
    floorLabel.append(floorCheck, document.createTextNode("床の表示・非表示"));

    const lightLabel = document.createElement("p");
    lightLabel.textContent = `メインライトの強さ調節 ${s.lightIntensity.toFixed(2)}`;
    const light = document.createElement("input");
    light.type = "range";
    light.min = "0";
    light.max = "2";
    light.step = "0.05";
    light.value = String(s.lightIntensity);
    light.oninput = () => {
      const v = Number(light.value);
      this.store.patch({ lightIntensity: v });
      lightLabel.textContent = `メインライトの強さ調節 ${v.toFixed(2)}`;
    };

    const azLabel = document.createElement("p");
    azLabel.textContent = `光源の方位 ${s.lightAzimuth}°`;
    const az = document.createElement("input");
    az.type = "range";
    az.min = "0";
    az.max = "360";
    az.step = "1";
    az.value = String(s.lightAzimuth);
    az.oninput = () => {
      const v = Number(az.value);
      this.store.patch({ lightAzimuth: v });
      azLabel.textContent = `光源の方位 ${v}°`;
    };

    const elLabel = document.createElement("p");
    elLabel.textContent = `光源の高さ ${s.lightElevation}°`;
    const el = document.createElement("input");
    el.type = "range";
    el.min = "10";
    el.max = "85";
    el.step = "1";
    el.value = String(s.lightElevation);
    el.oninput = () => {
      const v = Number(el.value);
      this.store.patch({ lightElevation: v });
      elLabel.textContent = `光源の高さ ${v}°`;
    };

    const darkLabel = document.createElement("p");
    darkLabel.textContent = `影の濃さ ${s.shadowDarkness.toFixed(2)}`;
    const dark = document.createElement("input");
    dark.type = "range";
    dark.min = "0";
    dark.max = "1";
    dark.step = "0.05";
    dark.value = String(s.shadowDarkness);
    dark.oninput = () => {
      const v = Number(dark.value);
      this.store.patch({ shadowDarkness: v });
      darkLabel.textContent = `影の濃さ ${v.toFixed(2)}`;
    };

    const alphaLabel = document.createElement("label");
    alphaLabel.className = "check-row";
    const alphaCheck = document.createElement("input");
    alphaCheck.type = "checkbox";
    alphaCheck.checked = s.transparentBg;
    alphaCheck.onchange = () => this.store.patch({ transparentBg: alphaCheck.checked });
    alphaLabel.append(alphaCheck, document.createTextNode("背景透明化モード切り替え"));

    const sizeLabel = document.createElement("p");
    sizeLabel.textContent = `床のサイズ ${s.floor.size}m`;
    const size = document.createElement("input");
    size.type = "range";
    size.min = "20";
    size.max = "400";
    size.value = String(s.floor.size);
    size.oninput = () => {
      const v = Number(size.value);
      this.store.patch({ floor: { ...this.store.get().floor, size: v } });
      sizeLabel.textContent = `床のサイズ ${v}m`;
    };

    const shadowBtn = document.createElement("button");
    const syncShadow = () => (shadowBtn.textContent = `影: ${this.store.get().shadows ? "ON" : "OFF"}`);
    syncShadow();
    shadowBtn.onclick = () => {
      this.store.patch({ shadows: !this.store.get().shadows });
      syncShadow();
    };

    host.append(
      patternLabel,
      pattern,
      colors,
      floorLabel,
      lightLabel,
      light,
      azLabel,
      az,
      elLabel,
      el,
      darkLabel,
      dark,
      alphaLabel,
      sizeLabel,
      size,
      shadowBtn,
    );
  }
}
