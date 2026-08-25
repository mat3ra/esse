import { type EntityGraph } from "./buildEntityGraph";
export interface DocsPage {
    slug: string;
    title: string;
    order: number;
    summary: string;
    body: string;
}
interface FrontMatter {
    [key: string]: string;
}
/** Splits a leading `---` block off the document. Enough for title/order/summary. */
export declare function parseFrontMatter(source: string): {
    data: FrontMatter;
    body: string;
};
export declare function expandFragments(body: string, graph: EntityGraph): string;
export declare function buildDocsPages(outputDir: string): DocsPage[];
export {};
