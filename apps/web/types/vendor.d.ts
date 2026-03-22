declare module "heic2any" {
  interface Options {
    blob: Blob;
    toType?: string;
    quality?: number;
  }
  function heic2any(options: Options): Promise<Blob | Blob[]>;
  export default heic2any;
}

declare module "@fal-ai/client" {
  export const fal: {
    config: (options: Record<string, unknown>) => void;
    storage: {
      upload: (file: File) => Promise<string>;
    };
    subscribe: (
      model: string,
      options: Record<string, unknown>,
    ) => Promise<{ data: { images: Array<{ url: string }> }; requestId: string }>;
  };
}
