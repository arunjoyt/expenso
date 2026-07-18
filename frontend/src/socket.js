import { io } from "socket.io-client";

function initSocket() {
	const host = window.location.hostname;
	const siteName = window.site_name;
	const socketioPort = window.socketio_port || 9000;
	const port = window.location.port ? `:${socketioPort}` : "";
	const protocol = port ? "http" : "https";
	const url = `${protocol}://${host}${port}/${siteName}`;

	return io(url, { withCredentials: true });
}

const socket = initSocket();

export default socket;
