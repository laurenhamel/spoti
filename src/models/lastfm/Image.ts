export interface Image {
  size: ImageSize;
  "#text": string;
}

export type ImageSize = "small" | "medium" | "large" | "extralarge";
