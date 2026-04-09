// Type shim for tesseract.js — loaded via CDN at runtime
// This prevents TS2307 without modifying package.json (frozen lockfile)
declare module "tesseract.js" {
  interface RecognizeResult {
    data: {
      text: string;
    };
  }

  interface LoggerMessage {
    progress: number;
    status: string;
  }

  interface RecognizeOptions {
    logger?: (message: LoggerMessage) => void;
    [key: string]: unknown;
  }

  function recognize(
    image: File | Blob | HTMLImageElement | HTMLCanvasElement | string,
    lang?: string,
    options?: RecognizeOptions,
  ): Promise<RecognizeResult>;

  const Tesseract: {
    recognize: typeof recognize;
  };

  export default Tesseract;
  export { recognize };
}
