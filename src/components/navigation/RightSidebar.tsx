import { Route, Switch } from "react-router";

import { useEffect, useState } from "preact/hooks";

import { internalSubscribe } from "../../lib/eventEmitter";

import SidebarBase from "./SidebarBase";
import MemberSidebar from "./right/MemberSidebar";
import { SearchSidebar } from "./right/Search";
import { GlobalDMSearch } from "./right/GlobalDMSearch";

export default function RightSidebar() {
    const [sidebar, setSidebar] = useState<"search" | "global_dm_search" | undefined>();
    const [searchQuery, setSearchQuery] = useState("");
    const [searchParams, setSearchParams] = useState<any>(null);
    const close = () => {
        setSidebar(undefined);
        setSearchQuery("");
        setSearchParams(null);
    };

    useEffect(
        () =>
            internalSubscribe("RightSidebar", "open", (type: string, data?: any) => {
                setSidebar(type as "search" | "global_dm_search" | undefined);
                if (type === "search") {
                    if (typeof data === "string") {
                        // Legacy support for string queries
                        setSearchQuery(data);
                        setSearchParams(null);
                    } else if (data?.query !== undefined) {
                        // New format with search parameters
                        setSearchQuery(data.query);
                        setSearchParams(data);
                    }
                }
            }),
        [],
    );

    useEffect(
        () =>
            internalSubscribe("RightSidebar", "close", () => {
                close();
            }),
        [],
    );

    const searchContent =
        sidebar === "search" ? (
            <SearchSidebar
                close={close}
                initialQuery={searchQuery}
                searchParams={searchParams}
            />
        ) : sidebar === "global_dm_search" ? (
            <GlobalDMSearch close={close} />
        ) : (
            <MemberSidebar />
        );

    return (
        <SidebarBase>
            <Switch>
                <Route path="/server/:server/channel/:channel">{searchContent}</Route>
                <Route path="/channel/:channel">{searchContent}</Route>
                <Route path="/">{searchContent}</Route>
            </Switch>
        </SidebarBase>
    );
}
