import "./main.css";

import { createApp } from "vue";
import { createPinia } from "pinia";
import { FrappeUI, setConfig, frappeRequest } from "frappe-ui";

import App from "./App.vue";
import router from "./router";

setConfig("resourceFetcher", frappeRequest);

const app = createApp(App);

app.use(FrappeUI, { socketio: false });
app.use(createPinia());
app.use(router);

app.mount("#app");
