// Vite's ?raw import: the file's contents as a string (used to load HTML fixtures).
declare module '*?raw' {
  const content: string;
  export default content;
}

// Vite's import.meta.glob, in the one form the tests use (eager ?raw imports).
interface ImportMeta {
  glob(
    pattern: string,
    options: { query: '?raw'; import: 'default'; eager: true },
  ): Record<string, string>;
}
