/** Tiny DOM helpers so the panel code stays readable. */
type Attrs = Record<string, string | number | boolean | ((e: Event) => void)>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: (Node | string | null | false | undefined)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === "function") {
      node.addEventListener(key.replace(/^on/, "").toLowerCase(), value as EventListener);
    } else if (key === "class") {
      node.className = String(value);
    } else if (key === "html") {
      node.innerHTML = String(value);
    } else if (value === false || value === null || value === undefined) {
      continue;
    } else {
      node.setAttribute(key, String(value));
    }
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

export const clear = (node: HTMLElement): void => {
  node.replaceChildren();
};

export const pct = (v: number): string => `${Math.round(v)}%`;
export const one = (v: number): string => v.toFixed(1);

export function money(billions: number): string {
  const sign = billions < 0 ? "-" : "";
  const abs = Math.abs(billions);
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(2)}tn`;
  return `${sign}$${Math.round(abs)}bn`;
}

/** A labelled meter. `invert` marks stats where high is bad. */
export function meter(label: string, value: number, invert = false, suffix = ""): HTMLElement {
  const good = invert ? 100 - value : value;
  const tone = good > 62 ? "ok" : good > 38 ? "warn" : "bad";
  return el("div", { class: "meter" }, [
    el("div", { class: "meter-head" }, [
      el("span", { class: "meter-label" }, [label]),
      el("span", { class: `meter-value ${tone}` }, [`${Math.round(value)}${suffix}`]),
    ]),
    el("div", { class: "meter-track" }, [
      el("div", { class: `meter-fill ${tone}`, style: `width:${Math.max(0, Math.min(100, value))}%` }),
    ]),
  ]);
}

/** A compact inline sparkline from a series of numbers. */
export function sparkline(values: number[], min: number, max: number, tone = "#e2c16e"): SVGElement {
  const w = 168;
  const h = 34;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("class", "spark");
  if (values.length < 2) return svg;
  const span = Math.max(0.001, max - min);
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((Math.min(max, Math.max(min, v)) - min) / span) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  path.setAttribute("points", points);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", tone);
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("stroke-linecap", "round");
  svg.append(path);
  return svg;
}
