declare module 'bs58' {
  function encode(buffer: Uint8Array | Buffer): string;
  function decode(value: string): Uint8Array;
  const bs58: { encode: typeof encode; decode: typeof decode };
  export default bs58;
}
