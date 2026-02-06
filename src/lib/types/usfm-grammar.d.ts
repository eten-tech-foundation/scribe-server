// Type definitions for usfm-grammar
// Project: https://github.com/Bridgeconn/usfm-grammar

declare module 'usfm-grammar' {
  export class USFMParser {
    /**
     * Create a new USFM parser
     * @param usfmString - The USFM text to parse (optional if using fromUsj)
     * @param level - Parser level (LEVEL.RELAXED for lenient parsing)
     * @param fromUsj - USJ object to convert to USFM
     */
    constructor(usfmString?: string | null, level?: any, fromUsj?: any);

    /**
     * Array of parsing errors
     */
    errors: any[];

    /**
     * The USFM text (when created from USJ)
     */
    usfm: string;

    /**
     * Convert USFM to USJ (Unified Scripture JSON) format
     * @param filter - Optional filter (e.g., FILTER.SCRIPTURE for scripture-only)
     * @returns USJ object
     */
    toUSJ(filter?: any): any;

    /**
     * Convert USFM to JSON format
     * @param filter - Optional filter (e.g., FILTER.SCRIPTURE for scripture-only)
     * @returns JSON object
     */
    toJSON(filter?: any): any;

    /**
     * Convert to CSV format
     * @returns CSV string
     */
    toCSV(): string;

    /**
     * Convert to TSV format
     * @returns TSV string
     */
    toTSV(): string;
  }

  export class JSONParser {
    /**
     * Create a JSON parser from JSON/USJ data
     * @param jsonData - The JSON/USJ data
     */
    constructor(jsonData: any);

    /**
     * Convert JSON/USJ back to USFM
     * @returns USFM string
     */
    toUSFM(): string;

    /**
     * Validate JSON against schema
     * @returns true if valid
     */
    validate(): boolean;
  }

  export enum LEVEL {
    RELAXED = 'relaxed',
    STRICT = 'strict',
  }

  export enum FILTER {
    SCRIPTURE = 'scripture',
  }

  export const JSONSchemaDefinition: any;
}
