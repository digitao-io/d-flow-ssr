export interface Page {
  key: string;
  title: string;
  description: string;
  urlPattern: string;

  details: PageDetails;
}
export interface PageDetails {
  template: string;
  language: ConfigValue;
  title: ConfigValue;
  config: Record<string, ConfigValue>;
  slots: Record<string, ComponentDetails[]>;
}

export interface ComponentDetails {
  component: string;
  config: Record<string, ConfigValue>;
}

export type ResolvedPageDetails = {
  template: string;
  language: string;
  title: string;
  config: Record<string, ResolvedValue>;
  slots: Record<string, ResolvedComponentDetails[]>;
};

export type ResolvedComponentDetails = {
  component: string;
  config: Record<string, ResolvedValue>;
};

export type ConfigValue =
  | ValueResolvingInfo
  | ResolvedValue;

export interface ValueResolvingInfo {
  $source: Array<string | ValueResolvingInfo>;
  field?: string;
}

export type ResolvedValue =
  | string
  | number
  | boolean
  | null
  | ResolvedArrayValue
  | ResolvedObjectValue;

export type ResolvedArrayValue = ResolvedValue[];
export interface ResolvedObjectValue {
  [key: string]: ResolvedValue;
}

export function isValueResolved(v: ConfigValue): v is ResolvedValue {
  return v === null
    || typeof v !== "object"
    || !(v as ValueResolvingInfo).$source;
}
