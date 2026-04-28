declare module "html-encoding-sniffer" {
  function sniffHTMLEncoding(
    buffer: Buffer,
    options?: {
      transportLayerEncodingLabel?: string | undefined;
      defaultEncoding?: string;
    }
  ): string | null;
  export default sniffHTMLEncoding;
}

declare module "dompurify" {
  interface DOMPurify {
    sanitize(dirty: string | Node, options?: unknown): string;
    addHook(hook: string, cb: (node: Node) => void): void;
  }
  function createDOMPurify(window?: unknown): DOMPurify;
  export default createDOMPurify;
}

declare module "jsdom" {
  export class JSDOM {
    constructor(html: string, options?: Record<string, unknown>);
    window: Window & { document: Document };
  }
}

declare module "iconv-lite" {
  export function decode(buffer: Buffer, encoding: string): string;
}
