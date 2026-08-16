import { API_URL, isRevoltApiUrl } from "./lib/apiUrl";

export const APP_VERSION = "__APP_VERSION__";
export const IS_REVOLT = isRevoltApiUrl(API_URL);
