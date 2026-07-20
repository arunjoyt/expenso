import "./main.css";

import { createApp } from "vue";
import { createPinia } from "pinia";
import { FrappeUI, setConfig, frappeRequest } from "frappe-ui";

import App from "./App.vue";
import router from "./router";
import { session } from "./data/session";

setConfig("resourceFetcher", frappeRequest);

const app = createApp(App);

app.use(FrappeUI, { socketio: false });
app.use(createPinia());
app.use(router);

session.restore().then(() => app.mount("#app"));
