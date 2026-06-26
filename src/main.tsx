import "./styles/tokens.css";
import "./styles/index.scss";
import { render } from "preact";

import "../external/lang/Languages.patch";
import { initPostHog } from "./analytics/posthog";
import { App } from "./pages/app";
import "./updateWorker";
import './sentry';

// Initialise PostHog analytics before rendering
initPostHog();

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
render(<App />, document.getElementById("app")!);
