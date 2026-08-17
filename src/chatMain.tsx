import "./styles/tokens.css";
import "./styles/index.scss";

import { render } from "preact";

import "../external/lang/Languages.patch";
import { App } from "./pages/app";
import "./posthog";
import "./updateWorker";
import "./sentry";

render(<App />, document.getElementById("app")!);
