/** FR034: リッチメニューのエリア分割プリセット。全レイアウト共通で画像サイズは2500x1686。 */
export type RichMenuLayoutKey = "one" | "two" | "four" | "six";

export type RichMenuBounds = { x: number; y: number; width: number; height: number };

export const RICH_MENU_IMAGE_SIZE = { width: 2500, height: 1686 };

export const RICH_MENU_LAYOUTS: Record<
  RichMenuLayoutKey,
  { label: string; bounds: RichMenuBounds[] }
> = {
  one: {
    label: "1分割(全面)",
    bounds: [{ x: 0, y: 0, width: 2500, height: 1686 }],
  },
  two: {
    label: "2分割(左右)",
    bounds: [
      { x: 0, y: 0, width: 1250, height: 1686 },
      { x: 1250, y: 0, width: 1250, height: 1686 },
    ],
  },
  four: {
    label: "4分割(2x2)",
    bounds: [
      { x: 0, y: 0, width: 1250, height: 843 },
      { x: 1250, y: 0, width: 1250, height: 843 },
      { x: 0, y: 843, width: 1250, height: 843 },
      { x: 1250, y: 843, width: 1250, height: 843 },
    ],
  },
  six: {
    label: "6分割(2x3)",
    bounds: [
      { x: 0, y: 0, width: 834, height: 843 },
      { x: 834, y: 0, width: 833, height: 843 },
      { x: 1667, y: 0, width: 833, height: 843 },
      { x: 0, y: 843, width: 834, height: 843 },
      { x: 834, y: 843, width: 833, height: 843 },
      { x: 1667, y: 843, width: 833, height: 843 },
    ],
  },
};

export const RICH_MENU_LAYOUT_KEYS = Object.keys(RICH_MENU_LAYOUTS) as RichMenuLayoutKey[];

export function isRichMenuLayoutKey(value: string): value is RichMenuLayoutKey {
  return (RICH_MENU_LAYOUT_KEYS as string[]).includes(value);
}
