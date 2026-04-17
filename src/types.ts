export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | {
      [key: string]: JsonValue;
    };

export interface CliGlobalOptions {
  verbose: boolean;
}

export interface SpawnResult {
  code: number;
  stdout: string;
  stderr: string;
}
