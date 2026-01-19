export interface BoundingBox {
  id: string;
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
  width: number; // Percentage 0-100
  height: number; // Percentage 0-100
}

export interface AnnotationMetadata {
  name: string;
  type: string;
  quality: 'Low' | 'Medium' | 'High';
}

export interface Annotation extends BoundingBox {
  metadata: AnnotationMetadata;
}

export interface ProjectImage {
  id: string;
  url: string;
  name: string;
  width?: number;
  height?: number;
  annotations: Annotation[];
  file?: File; // If uploaded locally
}

export interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
}
