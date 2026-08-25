export interface SiteLinkProblem {
    page: string;
    href: string;
    reason: string;
}
export declare function checkSiteLinks(siteDir: string): SiteLinkProblem[];
